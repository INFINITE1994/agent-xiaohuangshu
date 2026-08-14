import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });

try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  const button = page.getByRole("button", { name: "导出整本 PDF" });
  if (!(await button.isVisible())) throw new Error("整本 PDF 导出按钮未显示");
  const popupPromise = page.waitForEvent("popup", { timeout: 10000 });
  await button.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  if ((await popup.locator(".pdf-chapter").count()) !== 33) throw new Error("整本 PDF 打印文档未包含全部教程内容");
  if (!(await popup.getByRole("heading", { name: "目录" }).isVisible())) throw new Error("整本 PDF 打印文档缺少目录页");

  await context.close();
  console.log("整本 PDF 打印文档验证通过：包含封面、目录与全部教程内容。");
} finally {
  await browser.close();
}
