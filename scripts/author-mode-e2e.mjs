import { chromium } from "@playwright/test";

const authorCode = process.env.AUTHOR_CODE;
if (!authorCode) throw new Error("请通过 AUTHOR_CODE 环境变量提供作者访问码。");

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  if (await page.getByRole("button", { name: "编辑排版" }).isVisible().catch(() => false)) throw new Error("访客状态仍显示编辑排版入口");
  if (await page.getByRole("button", { name: "管理内容" }).isVisible().catch(() => false)) throw new Error("访客状态仍显示内容管理入口");
  await page.getByRole("banner").getByRole("button", { name: "作者解锁" }).click();
  await page.getByLabel("作者访问码").fill("invalid-static-author-code");
  await page.getByRole("button", { name: "解锁工作台" }).click();
  if (!(await page.getByRole("alert").isVisible())) throw new Error("旧访问码未被拒绝");
  await page.getByLabel("作者访问码").fill(authorCode);
  await page.getByRole("button", { name: "解锁工作台" }).click();
  if (!(await page.getByRole("button", { name: "编辑排版" }).isVisible())) throw new Error("作者解锁后未显示编辑排版入口");
  if (!(await page.getByRole("button", { name: "管理内容" }).isVisible())) throw new Error("作者解锁后未显示内容管理入口");
  await page.getByRole("button", { name: "退出作者模式" }).click();
  if (await page.getByRole("button", { name: "编辑排版" }).isVisible().catch(() => false)) throw new Error("退出作者模式后编辑入口仍可见");

  await context.close();
  console.log("静态作者模式验证通过：访客只读，正确访问码可解锁并可退出。\n");
} finally {
  await browser.close();
}
