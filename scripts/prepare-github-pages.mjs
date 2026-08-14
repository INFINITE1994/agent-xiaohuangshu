import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist/public");

function resolveSiteUrl() {
  const explicitUrl = process.env.SITE_URL?.trim();
  if (explicitUrl) return new URL(explicitUrl.endsWith("/") ? explicitUrl : `${explicitUrl}/`).href;

  const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
  if (!owner || !repository) return null;

  const isUserSite = repository.toLowerCase() === `${owner}.github.io`.toLowerCase();
  const suffix = isUserSite ? "/" : `/${repository}/`;
  return `https://${owner}.github.io${suffix}`;
}

function escapeXml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    '"': "&quot;",
  }[character]));
}

const siteUrl = resolveSiteUrl();
if (!siteUrl) {
  console.warn("未检测到 GitHub 仓库信息；保留 SEO 占位文件。手动发布时请设置 SITE_URL。");
  process.exit(0);
}

const [indexHtml, today] = [
  await readFile(path.join(outputDirectory, "index.html"), "utf8"),
  new Date().toISOString().slice(0, 10),
];
const heroImageUrl = new URL("offline-assets/agent-book-hero.webp", siteUrl).href;
const canonicalTags = `<link rel="canonical" href="${siteUrl}" />\n    <meta property="og:url" content="${siteUrl}" />`;
const enrichedIndexHtml = indexHtml
  .replace('meta property="og:image" content="./offline-assets/agent-book-hero.webp"', `meta property="og:image" content="${heroImageUrl}"`)
  .replace("</head>", `    ${canonicalTags}\n  </head>`);

const robots = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n  <url>\n    <loc>${escapeXml(siteUrl)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n    <image:image>\n      <image:loc>${escapeXml(heroImageUrl)}</image:loc>\n      <image:title>Agent小黄书：AI 智能体实践指南</image:title>\n    </image:image>\n  </url>\n</urlset>\n`;
const staticRouteFallback = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="robots" content="noindex" /><title>正在打开 Agent小黄书</title></head><body><script>
  (function () {
    var siteBase = ${JSON.stringify(new URL(siteUrl).pathname)};
    var path = window.location.pathname;
    var route = path.indexOf(siteBase) === 0 ? path.slice(siteBase.length) : path.replace(/^\\//, "");
    var suffix = route + window.location.search + window.location.hash;
    window.location.replace(${JSON.stringify(siteUrl)} + "?route=" + encodeURIComponent(suffix));
  }());
</script></body></html>`;

await Promise.all([
  writeFile(path.join(outputDirectory, "index.html"), enrichedIndexHtml),
  writeFile(path.join(outputDirectory, "404.html"), staticRouteFallback),
  writeFile(path.join(outputDirectory, "robots.txt"), robots),
  writeFile(path.join(outputDirectory, "sitemap.xml"), sitemap),
]);

console.log(`已生成 GitHub Pages SEO 地址：${siteUrl}`);
