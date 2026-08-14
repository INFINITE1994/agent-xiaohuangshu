import DOMPurify from "dompurify";
import { marked } from "marked";

const decorateEditorTokens = (markdown: string) =>
  markdown
    .replace(/\{\{color:(orange|ink|blue|green)\}\}([\s\S]*?)\{\{\/color\}\}/g, '<span class="formatted-text text-color-$1">$2</span>')
    .replace(/\{\{size:(small|large|xl)\}\}([\s\S]*?)\{\{\/size\}\}/g, '<span class="formatted-text text-size-$1">$2</span>');

export const renderMarkdown = (markdown: string) => {
  const html = marked.parse(decorateEditorTokens(markdown), { async: false, gfm: true, breaks: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ["class"] })
    .replace(/<pre>/g, '<pre class="copyable-block"><button type="button" class="copy-control" data-copy-target="code" aria-label="复制代码">复制</button>')
    .replace(/<blockquote>/g, '<blockquote class="copyable-block"><button type="button" class="copy-control" data-copy-target="quote" aria-label="复制重点文本">复制重点</button>')
    .replace(/<table>/g, '<div class="copyable-table"><button type="button" class="copy-control" data-copy-target="table" aria-label="复制表格为 Markdown">复制 Markdown</button><table>')
    .replace(/<\/table>/g, "</table></div>");
};

export const tableToMarkdown = (table: HTMLTableElement) => {
  const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => cell.innerText
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, "<br>")
    .trim()));
  if (!rows.length || !rows[0].length) return "";
  const columnCount = rows[0].length;
  const normalizedRows = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
  const [header, ...body] = normalizedRows;
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
};

export const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[character] ?? character));
