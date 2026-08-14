import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FilePenLine,
  FilePlus2,
  LayoutList,
  LockKeyhole,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { staticAssetUrl } from "@/lib/assets";
import { clearAuthorSessionKey, loadAuthorSessionKey, saveAuthorSessionKey } from "@/lib/author-session-key-store";
import { escapeHtml, renderMarkdown, tableToMarkdown } from "@/lib/markdown";
import {
  AUTHOR_ACCESS_HASH,
  AUTHOR_MANAGEMENT_SESSION_FLAG_KEY,
  AUTHOR_SESSION_FLAG_KEY,
  ENCRYPTED_PRIVATE_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  SELECTED_STORAGE_KEY,
  decryptPrivateSnapshot,
  derivePrivateContentKey,
  encryptPrivateSnapshot,
  hashAuthorCode,
  type EncryptedPrivatePayload,
} from "@/lib/private-content";
import { copyInitialContent, displayNumber, excerpt, initialContent, makeDraft, mergePrivateOverrides, partOrder, type ContentItem, type Draft } from "@/lib/tutorial-content";

export default function Home() {
  const [content, setContent] = useState<ContentItem[]>(copyInitialContent);
  const [selectedId, setSelectedId] = useState(() => {
    const savedId = window.localStorage.getItem(SELECTED_STORAGE_KEY);
    return savedId ?? initialContent[0]?.id ?? "";
  });
  const [query, setQuery] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(makeDraft());
  const [pendingDelete, setPendingDelete] = useState<ContentItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [authorCode, setAuthorCode] = useState("");
  const [authorError, setAuthorError] = useState("");
  const [authorBusy, setAuthorBusy] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const privateContentKeyRef = useRef<CryptoKey | null>(null);

  const persistContent = async (nextContent: ContentItem[]) => {
    const key = privateContentKeyRef.current;
    if (!key) {
      toast.error("作者加密会话未建立，请重新解锁后再保存。\n");
      return false;
    }
    try {
      const encryptedPayload = await encryptPrivateSnapshot(nextContent, key);
      window.localStorage.setItem(ENCRYPTED_PRIVATE_STORAGE_KEY, JSON.stringify(encryptedPayload));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      setContent(nextContent);
      return true;
    } catch {
      toast.error("无法加密保存到浏览器本地存储；请检查存储权限后重试。\n");
      return false;
    }
  };

  const hydratePrivateContent = async (key: CryptoKey) => {
    try {
      const encrypted = window.localStorage.getItem(ENCRYPTED_PRIVATE_STORAGE_KEY);
      if (encrypted) {
        const payload = JSON.parse(encrypted) as EncryptedPrivatePayload;
        const decryptedContent = await decryptPrivateSnapshot(payload, key);
        if (!decryptedContent.length) return copyInitialContent();
        if (payload.version === 2) return decryptedContent;

        // 兼容旧版仅保存“覆盖项”的密文，并立即迁移为可持久化删除操作的完整快照。
        const migratedContent = mergePrivateOverrides(decryptedContent);
        window.localStorage.setItem(ENCRYPTED_PRIVATE_STORAGE_KEY, JSON.stringify(await encryptPrivateSnapshot(migratedContent, key)));
        return migratedContent;
      }
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migratedContent = JSON.parse(legacy) as ContentItem[];
        window.localStorage.setItem(ENCRYPTED_PRIVATE_STORAGE_KEY, JSON.stringify(await encryptPrivateSnapshot(migratedContent, key)));
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migratedContent;
      }
    } catch {
      toast.error("无法读取已加密的作者内容，已按公开教程继续浏览。\n");
    }
    return copyInitialContent();
  };

  const persistSelectedId = (id: string) => {
    window.localStorage.setItem(SELECTED_STORAGE_KEY, id);
    setSelectedId(id);
  };

  const copyText = async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const clipboardFallback = document.createElement("textarea");
    clipboardFallback.value = text;
    clipboardFallback.setAttribute("readonly", "");
    clipboardFallback.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(clipboardFallback);
    clipboardFallback.select();
    const copied = document.execCommand("copy");
    clipboardFallback.remove();
    if (!copied) throw new Error("浏览器未允许复制");
  };

  const handleTutorialCopy = async (event: MouseEvent<HTMLDivElement>) => {
    const copyButton = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-copy-target]");
    if (!copyButton) return;
    const copyTarget = copyButton.dataset.copyTarget;
    const block = copyButton.closest<HTMLElement>(copyTarget === "code" ? "pre" : copyTarget === "quote" ? "blockquote" : ".copyable-table");
    if (!block) return;
    const table = copyTarget === "table" ? block.querySelector<HTMLTableElement>("table") : null;
    const copySource = block.cloneNode(true) as HTMLElement;
    copySource.querySelector(".copy-control")?.remove();
    const text = table ? tableToMarkdown(table) : copySource.innerText.trim();
    if (!text) return;

    try {
      await copyText(text);
      const originalLabel = copyButton.textContent;
      copyButton.textContent = "已复制";
      copyButton.setAttribute("aria-label", "复制成功");
      toast.success(copyTarget === "code" ? "代码已复制到剪贴板。" : copyTarget === "table" ? "表格 Markdown 已复制到剪贴板。" : "重点文本已复制到剪贴板。");
      window.setTimeout(() => {
        copyButton.textContent = originalLabel;
        copyButton.setAttribute("aria-label", copyTarget === "code" ? "复制代码" : copyTarget === "table" ? "复制表格为 Markdown" : "复制重点文本");
      }, 1800);
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限。");
    }
  };

  useEffect(() => {
    let active = true;
    const restorePreviewAuthorSession = async () => {
      if (window.sessionStorage.getItem(AUTHOR_SESSION_FLAG_KEY) !== "active") return;
      try {
        const key = await loadAuthorSessionKey();
        if (!key || !active) return;
        privateContentKeyRef.current = key;
        const hydratedContent = await hydratePrivateContent(key);
        if (!active) return;
        setContent(hydratedContent);
        const savedSelectedId = window.localStorage.getItem(SELECTED_STORAGE_KEY);
        persistSelectedId(hydratedContent.some((item) => item.id === savedSelectedId) ? savedSelectedId ?? "" : hydratedContent[0]?.id ?? "");
        setIsAuthor(window.sessionStorage.getItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY) === "active");
      } catch {
        window.sessionStorage.removeItem(AUTHOR_SESSION_FLAG_KEY);
        window.sessionStorage.removeItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY);
      }
    };
    void restorePreviewAuthorSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (content.length && !content.some((item) => item.id === selectedId)) {
      persistSelectedId(content[0]?.id ?? "");
    }
  }, [content, selectedId]);

  const selectedItem = content.find((item) => item.id === selectedId) ?? content[0];
  const selectedIndex = selectedItem ? content.findIndex((item) => item.id === selectedItem.id) : 0;
  const selectedMarkdownHtml = useMemo(() => renderMarkdown(selectedItem?.markdown ?? ""), [selectedItem?.markdown]);
  const draftMarkdownHtml = useMemo(() => renderMarkdown(draft.markdown), [draft.markdown]);

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return content;
    return content.filter((item) => [item.part, item.title, item.markdown].join(" ").toLowerCase().includes(keyword));
  }, [content, query]);

  const visibleParts = useMemo(() => {
    const existingParts = Array.from(new Set([...partOrder, ...content.map((item) => item.part)]));
    return existingParts
      .map((part) => ({ part, items: visibleItems.filter((item) => item.part === part) }))
      .filter(({ items }) => items.length > 0);
  }, [content, visibleItems]);

  const selectItem = (id: string) => {
    persistSelectedId(id);
    setMenuOpen(false);
    window.setTimeout(() => document.getElementById("reading-canvas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const openCreate = () => {
    if (!isAuthor) {
      setAuthorDialogOpen(true);
      return;
    }
    setEditingId(null);
    setDraft(makeDraft());
    setDrawerOpen(true);
  };

  const openEdit = (item: ContentItem) => {
    if (!isAuthor) {
      setAuthorDialogOpen(true);
      return;
    }
    setEditingId(item.id);
    setDraft({ part: item.part, number: item.number, title: item.title, kind: item.kind, markdown: item.markdown });
    setDrawerOpen(true);
  };

  const restoreEditorSelection = (start: number, end: number) => {
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(start, end);
    });
  };

  const wrapSelectedText = (opening: string, closing: string, fallback: string) => {
    const textarea = editorRef.current;
    const start = textarea?.selectionStart ?? draft.markdown.length;
    const end = textarea?.selectionEnd ?? draft.markdown.length;
    const selectedText = draft.markdown.slice(start, end) || fallback;
    const nextMarkdown = `${draft.markdown.slice(0, start)}${opening}${selectedText}${closing}${draft.markdown.slice(end)}`;
    setDraft((value) => ({ ...value, markdown: nextMarkdown }));
    restoreEditorSelection(start + opening.length, start + opening.length + selectedText.length);
  };

  const insertBlock = (block: string) => {
    const textarea = editorRef.current;
    const start = textarea?.selectionStart ?? draft.markdown.length;
    const end = textarea?.selectionEnd ?? start;
    const prefix = start > 0 && !draft.markdown.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    const suffix = end < draft.markdown.length && !draft.markdown.slice(end).startsWith("\n\n") ? "\n\n" : "";
    const nextMarkdown = `${draft.markdown.slice(0, start)}${prefix}${block}${suffix}${draft.markdown.slice(end)}`;
    setDraft((value) => ({ ...value, markdown: nextMarkdown }));
    const cursor = start + prefix.length + block.length;
    restoreEditorSelection(cursor, cursor);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthor) {
      setDrawerOpen(false);
      setAuthorDialogOpen(true);
      return;
    }
    if (!draft.title.trim() || !draft.markdown.trim()) {
      toast.error("请填写章节标题与正文后再保存。");
      return;
    }

    const now = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date())
      .replaceAll("/", ".");
    const next: ContentItem = {
      ...draft,
      id: editingId ?? crypto.randomUUID(),
      part: draft.part.trim() || "我的实践笔记",
      number: draft.number.trim() || "自定义",
      title: draft.title.trim(),
      markdown: draft.markdown.trim(),
      modifiedAt: `个人版本 · ${now}`,
      isCustom: !editingId || content.find((item) => item.id === editingId)?.isCustom === true,
    };

    const nextContent = editingId ? content.map((item) => (item.id === editingId ? next : item)) : [...content, next];
    if (!(await persistContent(nextContent))) return;
    persistSelectedId(next.id);
    setDrawerOpen(false);
    toast.success(editingId ? "本节已保存为当前浏览器的个人版本。" : "新的实践笔记已加入手册。");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    if (!isAuthor) {
      setPendingDelete(null);
      setAuthorDialogOpen(true);
      return;
    }
    const nextContent = content.filter((item) => item.id !== pendingDelete.id);
    if (!(await persistContent(nextContent))) return;
    if (pendingDelete.id === selectedId) persistSelectedId(nextContent[0]?.id ?? "");
    toast.success(`已从当前浏览器移除「${pendingDelete.title}」。`);
    setPendingDelete(null);
  };

  const resetContent = async () => {
    if (!isAuthor) {
      setAuthorDialogOpen(true);
      return;
    }
    if (!window.confirm("恢复原始教程会覆盖此浏览器中的全部编辑与新增内容，是否继续？")) return;
    const restored = copyInitialContent();
    if (!(await persistContent(restored))) return;
    persistSelectedId(restored[0]?.id ?? "");
    setQuery("");
    toast.success("已恢复基础教程 V0.1。\n");
  };

  const exportPdf = async () => {
    const exportContent = [...content];
    if (!exportContent.length) return;

    const printWindow = window.open("", "agent-xiaohuangshu-full-pdf", "width=960,height=900");
    if (!printWindow) {
      toast.error("浏览器阻止了导出窗口，请允许弹窗后重试。\n");
      return;
    }

    setExporting(true);
    const directory = exportContent
      .map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.part)}</em></li>`)
      .join("");
    const chapters = exportContent
      .map((item, index) => `
        <section class="pdf-chapter" data-export-section="${index + 1}">
          <header class="pdf-chapter-head">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <div><p>${escapeHtml(item.part)}</p><h2>${escapeHtml(item.title)}</h2><small>${escapeHtml(item.modifiedAt)}</small></div>
          </header>
          <div class="markdown-body">${renderMarkdown(item.markdown)}</div>
        </section>`)
      .join("");
    const exportMarkup = `
      <section class="pdf-cover">
        <p>AGENT小黄书 · V0.1</p>
        <h1>Agent小黄书</h1>
        <h2>从零基础到可交付的能力</h2>
        <div><span>完整教程导出</span><span>${exportContent.length} 个内容单元</span></div>
      </section>
      <section class="pdf-directory"><p>CONTENTS</p><h2>目录</h2><ol>${directory}</ol></section>
      <main>${chapters}</main>`;
    const baseHref = escapeHtml(new URL(import.meta.env.BASE_URL, window.location.href).href);

    try {
      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><base href="${baseHref}" /><title>Agent小黄书｜完整教程</title><style>
        @page { size: A4; margin: 12mm 10mm; }
        html,body { margin:0; background:#fffdf8; color:#20201d; font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
        .full-pdf-export { width:100%; background:#fffdf8; }
        .pdf-cover { min-height:265mm; display:flex; flex-direction:column; justify-content:center; padding:25mm; box-sizing:border-box; background:linear-gradient(135deg,#fffdf8,#eee7da); page-break-after:always; break-after:page; }
        .pdf-cover>p,.pdf-directory>p { color:#e94e1b; font-family:monospace; font-weight:700; letter-spacing:.14em; }
        .pdf-cover h1 { margin:16mm 0 0; font-family:"Noto Serif SC","Songti SC",serif; font-size:42pt; line-height:1; }
        .pdf-cover h2 { margin:7mm 0 0; color:#e94e1b; font-family:"Noto Serif SC","Songti SC",serif; font-size:23pt; }
        .pdf-cover>div { display:flex; gap:4mm; margin-top:18mm; color:#555; font-size:9pt; }.pdf-cover>div span { border:1px solid #aaa; padding:2.5mm 3mm; }
        .pdf-directory { min-height:265mm; padding:18mm 20mm; box-sizing:border-box; page-break-after:always; break-after:page; }.pdf-directory h2 { margin:4mm 0 0; font-family:"Noto Serif SC","Songti SC",serif; font-size:30pt; }
        .pdf-directory ol { display:grid; grid-template-columns:1fr 1fr; gap:2mm 8mm; margin-top:10mm; padding:0; list-style:none; }.pdf-directory li { display:grid; grid-template-columns:10mm minmax(0,1fr); gap:2mm; border-bottom:1px solid #ddd; padding:2mm 0; }.pdf-directory li span { color:#e94e1b; font:700 7pt monospace; }.pdf-directory li strong { overflow:hidden; font-family:"Noto Serif SC","Songti SC",serif; font-size:8.5pt; text-overflow:ellipsis; white-space:nowrap; }.pdf-directory li em { grid-column:2; color:#777; font-size:6.5pt; font-style:normal; }
        .pdf-chapter { min-height:265mm; padding:15mm 18mm 18mm; box-sizing:border-box; page-break-after:always; break-after:page; }.pdf-chapter-head { display:grid; grid-template-columns:12mm minmax(0,1fr); gap:4mm; border-bottom:1.3pt solid #e94e1b; padding-bottom:5mm; break-after:avoid; page-break-after:avoid; }.pdf-chapter-head>span { color:#e94e1b; font:700 8pt monospace; }.pdf-chapter-head p { margin:0; color:#777; font:7pt monospace; letter-spacing:.08em; }.pdf-chapter-head h2 { margin:2mm 0 0; font-family:"Noto Serif SC","Songti SC",serif; font-size:20pt; line-height:1.22; }.pdf-chapter-head small { display:block; margin-top:2mm; color:#777; font:6.5pt monospace; }
        .markdown-body { padding-top:8mm; color:#2b2a26; font-size:10pt; line-height:1.75; overflow-wrap:anywhere; }.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4 { font-family:"Noto Serif SC","Songti SC",serif; color:#20201d; break-after:avoid; page-break-after:avoid; }.markdown-body h2 { border-left:3pt solid #e94e1b; padding-left:3mm; }.markdown-body blockquote { margin:5mm 0; border-left:2pt solid #e94e1b; padding:3mm 4mm; background:#f3ede1; }.markdown-body pre { white-space:pre-wrap; overflow-wrap:anywhere; border-left:3pt solid #e94e1b; padding:4mm; background:#24231f; color:#fff; }.markdown-body table { width:100%; border-collapse:collapse; font-size:8.5pt; }.markdown-body th,.markdown-body td { border:1px solid #bbb; padding:2mm; vertical-align:top; }.markdown-body th { background:#efe9dd; }
        .copy-control { display:none !important; }.text-color-orange { color:#e94e1b; }.text-color-ink { color:#20201d; }.text-color-blue { color:#355c7d; }.text-color-green { color:#536b43; }.text-size-small { font-size:.82em; }.text-size-large { font-size:1.22em;font-weight:700; }.text-size-xl { color:#e94e1b;font-size:1.48em;font-weight:900; }
      </style></head><body><section class="full-pdf-export">${exportMarkup}</section></body></html>`);
      printWindow.document.close();

      await new Promise<void>((resolve) => {
        if (printWindow.document.readyState === "complete") {
          resolve();
          return;
        }
        printWindow.addEventListener("load", () => resolve(), { once: true });
        window.setTimeout(resolve, 1800);
      });

      const imageReadiness = Array.from(printWindow.document.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
          window.setTimeout(resolve, 5000);
        });
      });
      const fontReadiness = printWindow.document.fonts ? printWindow.document.fonts.ready.catch(() => undefined) : Promise.resolve();
      await Promise.all([fontReadiness, ...imageReadiness]);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));

      const renderedSectionCount = printWindow.document.querySelectorAll(".pdf-chapter").length;
      if (renderedSectionCount !== exportContent.length) {
        throw new Error(`导出章节核对失败：应为 ${exportContent.length} 节，实际为 ${renderedSectionCount} 节。`);
      }

      let fallbackTimer = 0;
      const finishExport = () => {
        window.clearTimeout(fallbackTimer);
        setExporting(false);
      };
      printWindow.addEventListener("afterprint", finishExport, { once: true });
      fallbackTimer = window.setTimeout(finishExport, 120000);
      printWindow.focus();
      printWindow.print();
      toast.success(`已核对 ${renderedSectionCount} 节教程并打开完整打印窗口，请选择“另存为 PDF”。`);
    } catch (error) {
      setExporting(false);
      printWindow.close();
      toast.error(error instanceof Error ? error.message : "整本 PDF 导出准备失败，请重试。\n");
    }
  };

  const unlockAuthorMode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authorCode.trim()) {
      setAuthorError("请输入作者访问码。");
      return;
    }
    setAuthorBusy(true);
    setAuthorError("");
    try {
      const hashedCode = await hashAuthorCode(authorCode.trim());
      if (hashedCode !== AUTHOR_ACCESS_HASH) {
        setAuthorError("访问码不正确，请重新输入。");
        return;
      }
      const privateContentKey = await derivePrivateContentKey(authorCode.trim());
      privateContentKeyRef.current = privateContentKey;
      try {
        await saveAuthorSessionKey(privateContentKey);
        window.sessionStorage.setItem(AUTHOR_SESSION_FLAG_KEY, "active");
        window.sessionStorage.setItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY, "active");
      } catch {
        window.sessionStorage.removeItem(AUTHOR_SESSION_FLAG_KEY);
        window.sessionStorage.removeItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY);
      }
      const hydratedContent = await hydratePrivateContent(privateContentKey);
      setContent(hydratedContent);
      persistSelectedId(hydratedContent.some((item) => item.id === selectedId) ? selectedId : hydratedContent[0]?.id ?? "");
      setIsAuthor(true);
      setAuthorCode("");
      setAuthorDialogOpen(false);
      toast.success("作者模式已解锁，内容管理与排版功能现已可用。");
    } catch {
      setAuthorError("当前浏览器无法验证访问码，请刷新页面后重试。");
    } finally {
      setAuthorBusy(false);
    }
  };

  const exitAuthorMode = () => {
    privateContentKeyRef.current = null;
    window.sessionStorage.removeItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY);
    setIsAuthor(false);
    setManagerOpen(false);
    setDrawerOpen(false);
    toast.message("已退出管理模式，已保存的阅读内容会继续保留为当前版本。");
  };

  const renderSectionLinks = (compact = false) => (
    <div className={compact ? "mobile-index" : "rail-index"}>
      {visibleParts.map(({ part, items }) => (
        <div className="part-index" key={part}>
          <p className="part-name">{part}</p>
          <div className="space-y-1">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => selectItem(item.id)}
                className={`chapter-link ${selectedItem?.id === item.id ? "is-active" : ""}`}
                title={item.title}
              >
                <span className="chapter-number">{displayNumber(item)}</span>
                <span className="truncate">{item.title.replace(/^第\s*\d+\s*章\s*/, "")}</span>
                {item.isCustom && <span className="chapter-count">改</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!selectedItem) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f0e7] p-6 text-[#20201d]">教程内容为空。请恢复原始教程后重试。</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f0e7] text-[#20201d] selection:bg-[#e94e1b] selection:text-white">
      <div className="paper-grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <div className="relative z-10 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="site-rail print-hidden hidden min-h-screen border-r border-[#20201d]/10 bg-[#ebe5d8]/84 px-6 py-8 lg:flex lg:flex-col">
          <a href="#top" className="brand-lockup masthead group flex items-center gap-3" aria-label="返回页面顶部">
            <span className="brand-mark"><img src={staticAssetUrl("agent-book-mark.webp")} alt="" /></span>
            <span><span className="brand-kicker">THE PRACTICAL GUIDE</span><span className="brand-name">Agent小黄书</span></span>
          </a>
          <div className="mt-12 flex min-h-0 flex-1 flex-col">
            <div className="flex items-end justify-between"><p className="rail-label">全书目录</p><span className="rail-count">{content.length} 节</span></div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{renderSectionLinks()}</div>
          </div>
          <div className="mt-6 border-t border-[#20201d]/10 pt-5">
            <p className="rail-label">说明</p>
            <p className="mt-3 text-sm leading-6 text-[#20201d]/62">你可导出整本教程为 PDF，也可随时恢复原始全文。</p>
            {isAuthor ? <button type="button" onClick={resetContent} className="rail-reset mt-4"><RotateCcw size={14} /> 恢复原始教程</button> : <button type="button" onClick={() => setAuthorDialogOpen(true)} className="rail-reset mt-4"><LockKeyhole size={14} /> 作者解锁</button>}
          </div>
        </aside>

        <div className="min-w-0">
          <header className="print-hidden sticky top-0 z-30 border-b border-[#20201d]/10 bg-[#f4f0e7]/94 px-5 py-3 backdrop-blur-xl lg:px-10">
            <div className="flex items-center justify-between gap-3">
              <a href="#top" className="brand-lockup masthead flex items-center gap-2 lg:hidden" aria-label="返回页面顶部">
                <span className="brand-mark h-8 w-8"><img src={staticAssetUrl("agent-book-mark.webp")} alt="" /></span><span className="brand-name text-[1.05rem]">Agent小黄书</span>
              </a>
              <div className="hidden items-center gap-2 text-xs font-medium tracking-[0.12em] text-[#20201d]/52 md:flex"><span className="h-2 w-2 rounded-full bg-[#e94e1b]" /> 持续更新 V0.1</div>
              <div className="ml-auto flex items-center gap-2">
                {isAuthor ? <><button type="button" className="top-action hidden md:inline-flex" onClick={() => openEdit(selectedItem)}><FilePenLine size={16} /> 编辑排版</button><button type="button" className="top-action hidden sm:inline-flex" onClick={() => setManagerOpen(true)}><LayoutList size={16} /> 管理内容</button><button type="button" className="author-status hidden lg:inline-flex" onClick={exitAuthorMode}><LogOut size={14} /> 退出作者模式</button></> : <button type="button" className="top-action hidden sm:inline-flex" onClick={() => setAuthorDialogOpen(true)}><LockKeyhole size={16} /> 作者解锁</button>}
                <button type="button" className="top-action top-action-primary" onClick={exportPdf} disabled={exporting}><Download size={16} /> <span className="hidden sm:inline">{exporting ? "正在导出" : "导出整本 PDF"}</span></button>
                <button type="button" className="mobile-menu sm:hidden" onClick={() => setMenuOpen(true)} aria-label="打开目录"><Menu size={20} /></button>
              </div>
            </div>
          </header>

          {menuOpen && (
            <div className="print-hidden fixed inset-0 z-50 bg-[#20201d]/30 backdrop-blur-sm sm:hidden" role="dialog" aria-modal="true">
              <div className="absolute right-0 top-0 flex h-full w-[min(90vw,390px)] flex-col bg-[#f4f0e7] p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#20201d]/10 pb-5"><span className="brand-name text-xl">完整目录</span><button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="关闭目录"><X size={20} /></button></div>
                <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{renderSectionLinks(true)}</div>
                <button type="button" onClick={() => { isAuthor ? setManagerOpen(true) : setAuthorDialogOpen(true); setMenuOpen(false); }} className="top-action mt-5 w-full justify-center">{isAuthor ? <><FilePenLine size={16} /> 管理内容</> : <><LockKeyhole size={16} /> 作者解锁</>}</button>
              </div>
            </div>
          )}

          <main id="top" className="px-5 pb-16 pt-7 sm:px-8 lg:px-10 lg:pt-10 xl:px-14">
            <section className="hero-panel relative overflow-hidden" aria-labelledby="hero-title">
              <img src={staticAssetUrl("agent-book-hero.webp")} alt="抽象的橙色书封与纸张结构" className="absolute inset-0 h-full w-full object-cover" />
              <div className="hero-scrim absolute inset-0" />
              <div className="relative z-10 flex min-h-[340px] max-w-[705px] flex-col justify-between p-7 sm:p-10 lg:min-h-[400px] lg:p-12">
                <div className="eyebrow-row"><span>INFINITE</span></div>
                <div><p className="hero-overline">AGENT小黄书 · LEARN AI FROM SCRATCH</p><h1 id="hero-title" className="hero-title">Agent<em>小黄书</em></h1><p className="hero-copy">抖音：001_INFINITE<span className="ml-8">X：@INFINITE_LIU</span></p></div>
                <div className="flex flex-wrap gap-3"><button type="button" onClick={() => selectItem(content[0]?.id ?? "")} className="ink-button">从导读开始 <ArrowRight size={17} /></button>{isAuthor ? <button type="button" onClick={openCreate} className="ghost-ink-button"><Plus size={17} /> 新建并排版</button> : <button type="button" onClick={() => setAuthorDialogOpen(true)} className="ghost-ink-button"><LockKeyhole size={17} /> 作者解锁后管理</button>}</div>
              </div>
            </section>

            <section className="reading-shell mt-9 lg:mt-12" id="reading-canvas">
              <div className="reading-heading border-b border-[#20201d]/14 pb-6">
                <div><p className="eyebrow">{selectedItem.part}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-5"><h2 className="content-title">正在阅读</h2><div className="stat-rack"><div><strong>{content.length}</strong><span>内容单元</span></div><div><strong>{partOrder.length}</strong><span>篇章与附录</span></div><div><strong>本地</strong><span>可编辑</span></div></div></div></div>
              </div>
              <div className="print-hidden flex flex-col gap-3 border-b border-[#20201d]/10 py-5 sm:flex-row sm:items-center sm:justify-between">
                <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索教程正文、章节标题" aria-label="搜索教程内容" />{query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索"><X size={15} /></button>}</label>
                <div className="flex items-center gap-2"><span className="hidden text-xs tracking-[0.12em] text-[#20201d]/50 sm:block">{visibleItems.length} 个结果</span>{isAuthor && <button type="button" onClick={openCreate} className="add-content-button"><FilePlus2 size={16} /> 新增内容</button>}</div>
              </div>

              {query && (
                <div className="print-hidden search-results"><p className="eyebrow">搜索结果</p><div className="mt-3 grid gap-2 md:grid-cols-2">{visibleItems.map((item) => <button type="button" key={item.id} onClick={() => selectItem(item.id)} className={`search-result ${selectedItem.id === item.id ? "is-current" : ""}`}><span>{displayNumber(item)}</span><strong>{item.title}</strong><p>{excerpt(item.markdown)}</p></button>)}</div></div>
              )}

              <article id="pdf-root" className="reader-paper mt-7">
                <header className="reader-header">
                  <div className="reader-index"><span>{displayNumber(selectedItem)}</span><i /><span>{selectedItem.kind === "chapter" ? "CHAPTER" : selectedItem.kind.toUpperCase()}</span></div>
                  <div className="reader-title-wrap"><p className="eyebrow">{selectedItem.part}</p><h2>{selectedItem.title}</h2><div className="reader-meta"><span>{selectedItem.modifiedAt}</span>{selectedItem.isCustom && <span className="personal-chip">个人内容</span>}</div></div>
                  {isAuthor && <div className="print-hidden reader-actions" data-html2canvas-ignore="true"><button type="button" onClick={() => openEdit(selectedItem)} aria-label="编辑当前章节"><Pencil size={16} /></button><button type="button" onClick={() => setPendingDelete(selectedItem)} aria-label="删除当前章节"><Trash2 size={16} /></button></div>}
                </header>
                <div className="reader-rule" />
                <div className="markdown-body" onClick={handleTutorialCopy} dangerouslySetInnerHTML={{ __html: selectedMarkdownHtml }} />
              </article>

              <nav className="print-hidden reader-navigation" aria-label="章节翻页">
                <button type="button" disabled={selectedIndex <= 0} onClick={() => selectItem(content[selectedIndex - 1]?.id ?? "")}><ArrowLeft size={17} /><span><small>上一节</small>{selectedIndex > 0 ? content[selectedIndex - 1].title : "已经是第一节"}</span></button>
                <button type="button" disabled={selectedIndex >= content.length - 1} onClick={() => selectItem(content[selectedIndex + 1]?.id ?? "")}><span className="text-right"><small>下一节</small>{selectedIndex < content.length - 1 ? content[selectedIndex + 1].title : "已经是最后一节"}</span><ArrowRight size={17} /></button>
              </nav>
            </section>
          </main>
          <footer className="print-hidden mx-5 border-t border-[#20201d]/12 py-7 text-xs tracking-[0.08em] text-[#20201d]/48 sm:mx-8 lg:mx-10 xl:mx-14"><div className="flex flex-wrap justify-between gap-3"><span>AGENT小黄书 · 专为小白提供的完整教程</span><span>作者：INFINITE</span></div></footer>
        </div>
      </div>

      {managerOpen && (
        <div className="print-hidden fixed inset-0 z-50 bg-[#20201d]/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="manager-title">
          <div className="manager-drawer absolute right-0 top-0 flex h-full w-full max-w-[700px] flex-col overflow-hidden bg-[#f7f3eb] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#20201d]/12 px-6 py-5 sm:px-9">
              <div><p className="eyebrow">本地内容工作台</p><h2 id="manager-title" className="mt-1 font-serif text-2xl font-bold">管理全部内容</h2></div>
              <button type="button" onClick={() => setManagerOpen(false)} className="icon-button" aria-label="关闭内容管理"><X size={20} /></button>
            </div>
            <div className="border-b border-[#20201d]/10 px-6 py-4 sm:px-9">
              <p className="text-sm leading-6 text-[#20201d]/64">这里显示当前浏览器保存的全部内容。编辑、删除或新增后会立即保存在本地；恢复原始教程可撤销全部本地修改。</p>
              <div className="format-feature-callout mt-4"><span className="eyebrow">可视化排版</span><strong>表格 · 代码块 · 字号 · 文字颜色</strong><p>点击“新建并排版”，或在任一内容右侧选择“编辑排版”，即可打开完整排版工具栏。</p></div>
              <button type="button" onClick={() => { setManagerOpen(false); openCreate(); }} className="add-content-button mt-4"><FilePlus2 size={16} /> 新建并排版</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-9">
              <div className="manager-list">
                {content.map((item) => (
                  <div className={`manager-item ${selectedItem.id === item.id ? "is-current" : ""}`} key={item.id}>
                    <button type="button" className="manager-item-main" onClick={() => { selectItem(item.id); setManagerOpen(false); }}>
                      <span className="manager-item-number">{displayNumber(item)}</span>
                      <span><strong>{item.title}</strong><small>{item.part} · {item.modifiedAt}</small></span>
                    </button>
                    <div className="manager-item-actions">
                      <button type="button" className="manager-edit-action" onClick={() => { setManagerOpen(false); openEdit(item); }} aria-label={`编辑排版 ${item.title}`}><Pencil size={15} /><span>编辑</span></button>
                      <button type="button" onClick={() => { setManagerOpen(false); setPendingDelete(item); }} aria-label={`删除 ${item.title}`}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-[#20201d]/10 px-6 py-5 sm:px-9"><button type="button" onClick={() => { setManagerOpen(false); resetContent(); }} className="rail-reset"><RotateCcw size={14} /> 恢复原始教程全文</button></div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div className="print-hidden fixed inset-0 z-50 bg-[#20201d]/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <div className="editor-drawer absolute right-0 top-0 h-full w-full max-w-[700px] overflow-y-auto bg-[#f7f3eb] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#20201d]/12 bg-[#f7f3eb]/95 px-6 py-5 backdrop-blur-xl sm:px-9"><div><p className="eyebrow">本地内容工作台</p><h2 id="editor-title" className="mt-1 font-serif text-2xl font-bold">{editingId ? "编辑当前内容" : "新增实践笔记"}</h2></div><button type="button" onClick={() => setDrawerOpen(false)} className="icon-button" aria-label="关闭编辑器"><X size={20} /></button></div>
            <form onSubmit={handleSave} className="space-y-6 px-6 py-7 sm:px-9">
              <div className="format-editor-intro"><span className="eyebrow">现在可以直接排版</span><p>选择正文中的文字，再使用下方工具栏调整<strong>字号与颜色</strong>；也可一键插入<strong>表格、代码块、引用和标题</strong>。</p></div>
              <div className="form-grid"><label><span>归属篇章</span><input value={draft.part} onChange={(event) => setDraft((value) => ({ ...value, part: event.target.value }))} placeholder="例如：我的实践笔记" /></label><label><span>章节索引</span><input value={draft.number} onChange={(event) => setDraft((value) => ({ ...value, number: event.target.value }))} placeholder="例如：25 或 附F" /></label></div>
              <label className="form-field"><span>章节标题</span><input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="写清这节内容要解决的问题" /></label>
              <div className="form-field"><span>正文与排版</span><div className="editor-toolbar" role="toolbar" aria-label="文本排版工具"><span className="toolbar-label">选中文字后操作</span><button type="button" onClick={() => wrapSelectedText("**", "**", "重点文字")} aria-label="加粗文字"><strong>B</strong></button><button type="button" onClick={() => wrapSelectedText("*", "*", "强调文字")} aria-label="斜体文字"><em>I</em></button><button type="button" onClick={() => insertBlock("## 小节标题")} aria-label="插入二级标题">H2</button><button type="button" onClick={() => insertBlock("> 这里填写提示、注释或重要结论。")} aria-label="插入引用提示">引用</button><span className="toolbar-divider" /><button type="button" onClick={() => wrapSelectedText("{{size:small}}", "{{/size}}", "较小文字")} aria-label="缩小字号">小</button><button type="button" onClick={() => wrapSelectedText("{{size:large}}", "{{/size}}", "较大文字")} aria-label="放大字号">大</button><button type="button" onClick={() => wrapSelectedText("{{size:xl}}", "{{/size}}", "重点大字")} aria-label="最大字号">特大</button><span className="toolbar-divider" /><button type="button" className="color-orange" onClick={() => wrapSelectedText("{{color:orange}}", "{{/color}}", "橙皮朱文字")} aria-label="设为橙皮朱">橙</button><button type="button" className="color-ink" onClick={() => wrapSelectedText("{{color:ink}}", "{{/color}}", "深墨文字")} aria-label="设为深墨">墨</button><button type="button" className="color-blue" onClick={() => wrapSelectedText("{{color:blue}}", "{{/color}}", "蓝灰文字")} aria-label="设为蓝灰">蓝</button><button type="button" className="color-green" onClick={() => wrapSelectedText("{{color:green}}", "{{/color}}", "深绿文字")} aria-label="设为深绿">绿</button><span className="toolbar-divider" /><button type="button" onClick={() => insertBlock("| 项目 | 说明 | 备注 |\n| --- | --- | --- |\n| 内容 | 在此填写 | 在此填写 |")} aria-label="插入表格">表格</button><button type="button" onClick={() => insertBlock("```ts\nconst message = '在这里写代码';\nconsole.log(message);\n```")} aria-label="插入代码块">代码</button></div><textarea ref={editorRef} rows={18} value={draft.markdown} onChange={(event) => setDraft((value) => ({ ...value, markdown: event.target.value }))} placeholder="可使用工具栏插入标题、表格、代码块、字号与文字颜色；也支持直接编辑 Markdown。" /></div>
              <div className="editor-preview"><div className="editor-preview-head"><span className="eyebrow">实时阅读预览</span><span>保存后将以此样式显示与导出</span></div><div className="markdown-body compact" dangerouslySetInnerHTML={{ __html: draftMarkdownHtml }} /></div>
              <div className="form-grid"><label><span>内容类型</span><select value={draft.kind} onChange={(event) => setDraft((value) => ({ ...value, kind: event.target.value as ContentItem["kind"] }))}><option value="chapter">正式章节</option><option value="supplement">导读或补充</option><option value="appendix">附录</option><option value="introduction">前言</option></select></label><div className="editor-tip"><BookOpen size={15} /><span>保存后，Markdown 会被渲染为当前手册的阅读版式。</span></div></div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#20201d]/10 pt-6"><p className="max-w-xs text-xs leading-5 text-[#20201d]/52">原始教程正文已导入。编辑仅会保存到这台设备的浏览器；可随时恢复原始内容。</p><div className="flex gap-2"><button type="button" onClick={() => setDrawerOpen(false)} className="top-action">取消</button><button type="submit" className="top-action top-action-primary"><Check size={16} /> 保存内容</button></div></div>
            </form>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="print-hidden fixed inset-0 z-[60] grid place-items-center bg-[#20201d]/45 p-5 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="delete-dialog w-full max-w-md bg-[#f7f3eb] p-7 shadow-2xl"><div className="flex items-start justify-between gap-4"><span className="delete-icon"><Trash2 size={19} /></span><button type="button" onClick={() => setPendingDelete(null)} className="icon-button" aria-label="关闭删除确认"><X size={19} /></button></div><p className="eyebrow mt-6">不可撤销的本地修改</p><h2 id="delete-title" className="mt-2 font-serif text-2xl font-bold">确定移除这一节？</h2><p className="mt-3 leading-7 text-[#20201d]/66">「{pendingDelete.title}」会从当前浏览器保存的手册中删除。恢复原始教程可重新导入。</p><div className="mt-7 flex justify-end gap-2"><button type="button" onClick={() => setPendingDelete(null)} className="top-action">保留内容</button><button type="button" onClick={confirmDelete} className="delete-button"><Trash2 size={16} /> 确认删除</button></div></div></div>
      )}

      {authorDialogOpen && (
        <div className="print-hidden fixed inset-0 z-[70] grid place-items-center bg-[#20201d]/48 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="author-unlock-title">
          <form onSubmit={unlockAuthorMode} className="author-unlock-dialog w-full max-w-md bg-[#f7f3eb] p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><span className="author-unlock-icon"><LockKeyhole size={20} /></span><button type="button" className="icon-button" onClick={() => { setAuthorDialogOpen(false); setAuthorError(""); setAuthorCode(""); }} aria-label="关闭作者解锁"><X size={19} /></button></div>
            <p className="eyebrow mt-6">STATIC AUTHOR MODE</p><h2 id="author-unlock-title" className="mt-2 font-serif text-2xl font-bold">解锁作者工作台</h2><p className="mt-3 leading-7 text-[#20201d]/66">解锁后可使用内容管理、排版、新增、编辑、删除与恢复功能。本次解锁仅在当前浏览器会话内有效。</p>
            <label className="form-field mt-6"><span>作者访问码</span><input type="password" value={authorCode} onChange={(event) => { setAuthorCode(event.target.value); setAuthorError(""); }} placeholder="输入作者访问码" autoFocus /></label>
            {authorError && <p className="author-error" role="alert">{authorError}</p>}
            <div className="mt-6 flex justify-end gap-2"><button type="button" className="top-action" onClick={() => setAuthorDialogOpen(false)}>仅浏览</button><button type="submit" className="top-action top-action-primary" disabled={authorBusy}><LockKeyhole size={16} /> {authorBusy ? "正在验证" : "解锁工作台"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
