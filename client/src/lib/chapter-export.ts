/* 橙皮工作台章节导出工具：保留纸张质感与深墨正文，让访客可把当前阅读章节带离网站。 */
import { escapeHtml, renderMarkdown } from "@/lib/markdown";
import { displayNumber, type ContentItem } from "@/lib/tutorial-content";

function fileStem(item: ContentItem) {
  const safeTitle = item.title
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `Agent小黄书-${displayNumber(item)}-${safeTitle || "当前章节"}`;
}

export function downloadChapterMarkdown(item: ContentItem) {
  const markdown = `# ${item.title}\n\n> 所属篇章：${item.part}  \n> 章节编号：${displayNumber(item)}  \n> 版本标记：${item.modifiedAt}\n\n---\n\n${item.markdown.trim()}\n`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${fileStem(item)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function openChapterPdfExport(item: ContentItem) {
  const printWindow = window.open("", "agent-xiaohuangshu-current-pdf", "width=900,height=900");
  if (!printWindow) throw new Error("浏览器阻止了导出窗口，请允许弹窗后重试。");

  const baseHref = escapeHtml(new URL(import.meta.env.BASE_URL, window.location.href).href);
  const styles = `@page{size:A4;margin:13mm 12mm}html,body{margin:0;background:#fffdf8;color:#20201d;font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}.chapter-export-head{display:grid;grid-template-columns:13mm minmax(0,1fr);gap:4mm;border-top:4pt solid #e94e1b;border-bottom:1.3pt solid #e94e1b;padding:6mm 0 5mm}.chapter-number{color:#e94e1b;font:700 8pt "IBM Plex Mono",monospace}.chapter-export-head p{margin:0;color:#777;font:7pt "IBM Plex Mono",monospace;letter-spacing:.1em}.chapter-export-head h1{margin:2mm 0 0;font-family:"Noto Serif SC","Songti SC",serif;font-size:22pt;line-height:1.2}.chapter-export-head small{display:block;margin-top:2mm;color:#777;font:6.5pt "IBM Plex Mono",monospace}.markdown-body{padding-top:8mm;font-size:10pt;line-height:1.78;overflow-wrap:anywhere}.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4{font-family:"Noto Serif SC","Songti SC",serif;color:#20201d;break-after:avoid;page-break-after:avoid}.markdown-body h2{border-left:3pt solid #e94e1b;padding-left:3mm}.markdown-body blockquote{margin:5mm 0;border-left:2pt solid #e94e1b;padding:3mm 4mm;background:#f3ede1}.markdown-body pre{white-space:pre-wrap;overflow-wrap:anywhere;border-left:3pt solid #e94e1b;padding:4mm;background:#24231f;color:#fff}.markdown-body table{width:100%;border-collapse:collapse;font-size:8.5pt}.markdown-body th,.markdown-body td{border:1px solid #bbb;padding:2mm;vertical-align:top}.markdown-body th{background:#efe9dd}.markdown-body img{display:block;max-width:100%;height:auto;margin:6mm auto;border-top:2pt solid #e94e1b}.copy-control{display:none!important}.text-color-orange{color:#e94e1b}.text-color-ink{color:#20201d}.text-color-blue{color:#355c7d}.text-color-green{color:#536b43}.text-size-small{font-size:.82em}.text-size-large{font-size:1.22em;font-weight:700}.text-size-xl{color:#e94e1b;font-size:1.48em;font-weight:900}.chapter-export-foot{margin-top:10mm;border-top:1px solid #ddd;padding-top:3mm;color:#777;font:6.5pt "IBM Plex Mono",monospace;letter-spacing:.08em}`;

  try {
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><base href="${baseHref}" /><title>${escapeHtml(item.title)}｜Agent小黄书</title><style>${styles}</style></head><body><main><header class="chapter-export-head"><span class="chapter-number">${escapeHtml(displayNumber(item))}</span><div><p>${escapeHtml(item.part)}</p><h1>${escapeHtml(item.title)}</h1><small>${escapeHtml(item.modifiedAt)}</small></div></header><div class="markdown-body">${renderMarkdown(item.markdown)}</div><footer class="chapter-export-foot">AGENT小黄书 · 当前章节导出</footer></main></body></html>`);
    printWindow.document.close();
    await new Promise<void>((resolve) => {
      if (printWindow.document.readyState === "complete") resolve();
      else printWindow.addEventListener("load", () => resolve(), { once: true });
      window.setTimeout(resolve, 1500);
    });
    await (printWindow.document.fonts ? printWindow.document.fonts.ready.catch(() => undefined) : Promise.resolve());
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
