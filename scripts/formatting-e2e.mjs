import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const title = "测试：排版工具栏";
  const editor = page.getByPlaceholder("可使用工具栏插入标题、表格、代码块、字号与文字颜色；也支持直接编辑 Markdown。");

  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "编辑排版" }).click();
  if (!(await page.getByRole("button", { name: "插入表格" }).isVisible())) throw new Error("主页面的编辑排版入口未打开工具栏");
  await page.getByRole("button", { name: "关闭编辑器" }).click();
  await page.getByRole("button", { name: "新建并排版" }).click();
  await page.getByLabel("章节标题").fill(title);
  await editor.fill("颜色文字");
  await editor.evaluate((node) => node.setSelectionRange(0, 4));
  await page.getByRole("button", { name: "设为橙皮朱" }).click();
  await page.getByRole("button", { name: "插入表格" }).click();
  await page.getByRole("button", { name: "插入代码块" }).click();

  const source = await editor.inputValue();
  if (!source.includes("{{color:orange}}") || !source.includes("| 项目 | 说明 | 备注 |") || !source.includes("```ts")) {
    throw new Error("排版工具栏未正确插入颜色、表格或代码标记");
  }

  await page.getByRole("button", { name: "保存内容" }).click();
  await page.getByRole("heading", { name: title }).waitFor();
  if (!(await page.locator(".markdown-body .text-color-orange").isVisible())) throw new Error("颜色样式未渲染");
  if (!(await page.locator(".markdown-body table").isVisible())) throw new Error("表格未渲染");
  if (!(await page.locator(".markdown-body pre").isVisible())) throw new Error("代码块未渲染");

  await context.close();
  console.log("排版工具栏与阅读渲染验证通过。");
} finally {
  await browser.close();
}
