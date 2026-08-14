import crypto from "node:crypto";
import express from "express";
import mysql from "mysql2/promise";

const requiredEnvironment = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "AUTHOR_ACCESS_HASH", "AUTHOR_SESSION_SECRET"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length) {
  throw new Error(`缺少 Render 环境变量：${missingEnvironment.join(", ")}`);
}

const app = express();
const port = Number(process.env.PORT ?? 10000);
const normalizeOrigin = (value) => new URL(value).origin.toLowerCase();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((value) => normalizeOrigin(value.trim()))
  .filter(Boolean));
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  enableKeepAlive: true,
});

const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const sign = (value) => crypto.createHmac("sha256", process.env.AUTHOR_SESSION_SECRET).update(value).digest("base64url");
const sessionDurationMs = 12 * 60 * 60 * 1000;
const timingSafeEqual = (left, right) => left.length === right.length && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));

function isAllowedOrigin(origin) {
  return !origin || allowedOrigins.has(normalizeOrigin(origin));
}

function verifyAuthorCode(value) {
  const suppliedHash = crypto.createHash("sha256").update(value).digest("hex");
  const expectedHash = process.env.AUTHOR_ACCESS_HASH;
  return timingSafeEqual(suppliedHash, expectedHash);
}

function issueToken() {
  const payload = toBase64Url(JSON.stringify({ exp: Date.now() + sessionDurationMs }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(authorization) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeEqual(signature, sign(payload))) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp > Date.now();
  } catch {
    return false;
  }
}

function validateContent(content) {
  if (!Array.isArray(content) || content.length === 0 || content.length > 200) return false;
  const serialized = JSON.stringify(content);
  if (Buffer.byteLength(serialized, "utf8") > 5 * 1024 * 1024) return false;
  return content.every((item) => item
    && typeof item.id === "string"
    && typeof item.part === "string"
    && typeof item.number === "string"
    && typeof item.title === "string"
    && typeof item.markdown === "string"
    && typeof item.modifiedAt === "string"
    && typeof item.isCustom === "boolean"
    && [item.id, item.part, item.number, item.title, item.markdown, item.modifiedAt].every((value) => value.length <= 500000));
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_content_publications (
      document_id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      content_json MEDIUMTEXT NOT NULL,
      version BIGINT UNSIGNED NOT NULL,
      published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function readPublication() {
  const [rows] = await pool.execute(
    "SELECT content_json AS contentJson, version, DATE_FORMAT(published_at, '%Y-%m-%dT%H:%i:%sZ') AS publishedAt FROM agent_content_publications WHERE document_id = 1",
  );
  const row = rows[0];
  if (!row) return { content: null, version: 0, publishedAt: null };
  return { content: JSON.parse(row.contentJson), version: Number(row.version), publishedAt: row.publishedAt };
}

app.use(express.json({ limit: "5mb" }));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (!isAllowedOrigin(origin)) return response.status(403).json({ error: "来源不在允许列表中。" });
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  if (request.method === "OPTIONS") return response.sendStatus(204);
  return next();
});

app.get("/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok" });
  } catch {
    response.status(503).json({ status: "unavailable" });
  }
});

app.get("/v1/content", async (_request, response, next) => {
  try {
    response.json(await readPublication());
  } catch (error) {
    next(error);
  }
});

app.post("/v1/author/session", (request, response) => {
  const accessCode = typeof request.body?.accessCode === "string" ? request.body.accessCode.trim() : "";
  if (!accessCode || !verifyAuthorCode(accessCode)) return response.status(401).json({ error: "作者访问码不正确。" });
  return response.json({ token: issueToken(), expiresIn: sessionDurationMs / 1000 });
});

app.put("/v1/content", async (request, response, next) => {
  if (!verifyToken(request.headers.authorization)) return response.status(401).json({ error: "作者会话已失效，请重新解锁。" });
  const { content, expectedVersion } = request.body ?? {};
  if (!validateContent(content) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    return response.status(400).json({ error: "发布内容格式不正确。" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT version FROM agent_content_publications WHERE document_id = 1 FOR UPDATE");
    const currentVersion = rows[0] ? Number(rows[0].version) : 0;
    if (currentVersion !== expectedVersion) {
      await connection.rollback();
      return response.status(409).json({ error: "云端内容已有更新，请刷新后再发布。", version: currentVersion });
    }

    const nextVersion = currentVersion + 1;
    const serialized = JSON.stringify(content);
    if (rows[0]) {
      await connection.execute("UPDATE agent_content_publications SET content_json = ?, version = ? WHERE document_id = 1", [serialized, nextVersion]);
    } else {
      await connection.execute("INSERT INTO agent_content_publications (document_id, content_json, version) VALUES (1, ?, ?)", [serialized, nextVersion]);
    }
    await connection.commit();
    const publication = await readPublication();
    return response.json(publication);
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

app.use((error, _request, response, _next) => {
  console.error("同步 API 发生错误", error);
  response.status(500).json({ error: "服务器暂时无法处理请求。" });
});

ensureSchema()
  .then(() => app.listen(port, "0.0.0.0", () => console.log(`内容同步 API 正在监听 ${port}`)))
  .catch((error) => {
    console.error("无法初始化内容同步 API", error);
    process.exit(1);
  });
