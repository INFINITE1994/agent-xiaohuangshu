import { chromium } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const title = "测试：本地内容管理";
const editedTitle = "测试：本地内容管理（已编辑）";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const assertVisible = async (locator, message) => {
    if (!(await locator.isVisible())) throw new Error(message);
  };

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "管理内容" }).waitFor();

  await page.getByRole("button", { name: "管理内容" }).click();
  await assertVisible(page.getByRole("heading", { name: "管理全部内容" }), "内容管理抽屉没有打开");
  await page.getByRole("dialog", { name: "管理全部内容" }).getByRole("button", { name: "新增内容" }).click();
  await page.getByLabel("章节标题").fill(title);
  await page.getByLabel("正文（支持 Markdown）").fill("# 自动化验证\n\n这是一条用于验证本地保存的内容。");
  await page.getByRole("button", { name: "保存内容" }).click();
  await assertVisible(page.getByRole("heading", { name: title }), "新增内容没有进入阅读页");

  await page.reload({ waitUntil: "domcontentloaded" });
  await assertVisible(page.getByRole("heading", { name: title }), "刷新后新增内容没有保留");

  await page.getByRole("button", { name: "编辑当前章节" }).click();
  await page.getByLabel("章节标题").fill(editedTitle);
  await page.getByRole("button", { name: "保存内容" }).click();
  await assertVisible(page.getByRole("heading", { name: editedTitle }), "编辑后的标题没有更新");

  await page.reload({ waitUntil: "domcontentloaded" });
  await assertVisible(page.getByRole("heading", { name: editedTitle }), "刷新后编辑内容没有保留");

  await page.getByRole("button", { name: "删除当前章节" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  if (await page.getByRole("heading", { name: editedTitle }).isVisible().catch(() => false)) {
    throw new Error("删除后的内容在刷新后仍然存在");
  }

  await context.close();
  console.log("内容管理新增、编辑、删除与刷新保存验证通过。");
} finally {
  await browser.close();
}
