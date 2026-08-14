import { chromium } from "@playwright/test";

const authorCode = process.env.AUTHOR_CODE;
if (!authorCode) throw new Error("请通过 AUTHOR_CODE 环境变量提供作者访问码。");

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const privateTitle = "加密私密笔记验证";
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("banner").getByRole("button", { name: "作者解锁" }).click();
  await page.getByLabel("作者访问码").fill(authorCode);
  await page.getByRole("button", { name: "解锁工作台" }).click();
  await page.getByRole("button", { name: "新建并排版" }).click();
  await page.getByLabel("章节标题").fill(privateTitle);
  await page.getByPlaceholder("可使用工具栏插入标题、表格、代码块、字号与文字颜色；也支持直接编辑 Markdown。").fill("这段内容应仅存在于加密存储中。");
  await page.getByRole("button", { name: "保存内容" }).click();

  const storageAudit = await page.evaluate(() => ({
    legacy: window.localStorage.getItem("agent-xiaohuangshu-full-tutorial-v2"),
    encrypted: window.localStorage.getItem("agent-xiaohuangshu-private-content-v1"),
  }));
  if (storageAudit.legacy !== null) throw new Error("发现未迁移的明文内容存储");
  if (!storageAudit.encrypted || storageAudit.encrypted.includes(privateTitle) || storageAudit.encrypted.includes("这段内容应仅存在于加密存储中。")) {
    throw new Error("私密内容未被加密保存");
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  if (await page.getByRole("heading", { name: privateTitle }).isVisible().catch(() => false)) throw new Error("刷新后的访客状态泄露了私密内容");
  await page.getByRole("banner").getByRole("button", { name: "作者解锁" }).click();
  await page.getByLabel("作者访问码").fill(authorCode);
  await page.getByRole("button", { name: "解锁工作台" }).click();
  await page.getByRole("button", { name: "管理内容" }).click();
  if (!(await page.getByRole("dialog", { name: "管理全部内容" }).getByText(privateTitle, { exact: true }).isVisible())) throw new Error("作者无法解密读取私密内容");

  await context.close();
  console.log("加密私密内容验证通过：本地仅保留密文，作者重新解锁后可读取。\n");
} finally {
  await browser.close();
}
