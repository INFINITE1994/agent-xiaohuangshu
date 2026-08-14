/* 橙皮作者工作台：以编辑桌、纸质章节卡和实时排版预览组织管理流程；强调深墨阅读层级与橙皮朱发布操作。 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Check, ChevronLeft, CloudUpload, FilePlus2, FileText, ImagePlus, LayoutList, LoaderCircle, LockKeyhole, LogOut, Pencil, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { staticAssetUrl } from "@/lib/assets";
import { clearAuthorSessionKey, loadAuthorSessionKey, saveAuthorSessionKey } from "@/lib/author-session-key-store";
import { clearAuthorToken, ContentApiError, fetchPublishedContent, isCloudSyncEnabled, MAXIMUM_CONTENT_IMAGE_BYTES, publishContent, readAuthorToken, startAuthorSession, uploadContentImage } from "@/lib/cloud-content";
import { renderMarkdown } from "@/lib/markdown";
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
import { copyInitialContent, displayNumber, initialContent, makeDraft, mergePrivateOverrides, partOrder, type ContentItem, type Draft } from "@/lib/tutorial-content";

const formatToday = () => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("/", ".");

export default function AuthorWorkbench() {
  const [, setLocation] = useLocation();
  const cloudSyncEnabled = isCloudSyncEnabled();
  const [content, setContent] = useState<ContentItem[]>(copyInitialContent);
  const [selectedId, setSelectedId] = useState(() => window.localStorage.getItem(SELECTED_STORAGE_KEY) ?? initialContent[0]?.id ?? "");
  const [isAuthor, setIsAuthor] = useState(false);
  const [cloudVersion, setCloudVersion] = useState(0);
  const [cloudReady, setCloudReady] = useState(!cloudSyncEnabled);
  const [authorCode, setAuthorCode] = useState("");
  const [authorError, setAuthorError] = useState("");
  const [authorBusy, setAuthorBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [partFilter, setPartFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(makeDraft());
  const [pendingDelete, setPendingDelete] = useState<ContentItem | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const privateContentKeyRef = useRef<CryptoKey | null>(null);

  const persistSelectedId = (id: string) => {
    window.localStorage.setItem(SELECTED_STORAGE_KEY, id);
    setSelectedId(id);
  };

  const hydratePrivateContent = async (key: CryptoKey) => {
    try {
      const encrypted = window.localStorage.getItem(ENCRYPTED_PRIVATE_STORAGE_KEY);
      if (encrypted) {
        const payload = JSON.parse(encrypted) as EncryptedPrivatePayload;
        const decrypted = await decryptPrivateSnapshot(payload, key);
        if (!decrypted.length) return copyInitialContent();
        if (payload.version === 2) return decrypted;
        const migrated = mergePrivateOverrides(decrypted);
        window.localStorage.setItem(ENCRYPTED_PRIVATE_STORAGE_KEY, JSON.stringify(await encryptPrivateSnapshot(migrated, key)));
        return migrated;
      }
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = JSON.parse(legacy) as ContentItem[];
        window.localStorage.setItem(ENCRYPTED_PRIVATE_STORAGE_KEY, JSON.stringify(await encryptPrivateSnapshot(migrated, key)));
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    } catch {
      toast.error("无法读取已加密的作者内容，已按公开教程继续加载。");
    }
    return copyInitialContent();
  };

  const persistContent = async (nextContent: ContentItem[]) => {
    if (cloudSyncEnabled) {
      try {
        const publication = await publishContent(nextContent, cloudVersion);
        setContent(publication.content ?? nextContent);
        setCloudVersion(publication.version);
        return true;
      } catch (error) {
        toast.error(error instanceof ContentApiError ? error.message : "云端发布失败，请检查内容服务后重试。");
        return false;
      }
    }

    const key = privateContentKeyRef.current;
    if (!key) {
      toast.error("作者加密会话未建立，请重新解锁后再保存。");
      return false;
    }
    try {
      window.localStorage.setItem(ENCRYPTED_PRIVATE_STORAGE_KEY, JSON.stringify(await encryptPrivateSnapshot(nextContent, key)));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      setContent(nextContent);
      return true;
    } catch {
      toast.error("无法加密保存到浏览器本地存储；请检查存储权限后重试。");
      return false;
    }
  };

  useEffect(() => {
    if (cloudSyncEnabled) return;
    let active = true;
    const restoreLocalSession = async () => {
      if (window.sessionStorage.getItem(AUTHOR_SESSION_FLAG_KEY) !== "active") return;
      const key = await loadAuthorSessionKey();
      if (!key || !active) return;
      privateContentKeyRef.current = key;
      const restored = await hydratePrivateContent(key);
      if (!active) return;
      setContent(restored);
      persistSelectedId(restored.some((item) => item.id === selectedId) ? selectedId : restored[0]?.id ?? "");
      setIsAuthor(window.sessionStorage.getItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY) === "active");
    };
    void restoreLocalSession();
    return () => { active = false; };
  }, [cloudSyncEnabled]);

  useEffect(() => {
    if (!cloudSyncEnabled) return;
    let active = true;
    const restoreCloudContent = async () => {
      try {
        const publication = await fetchPublishedContent();
        if (!active) return;
        if (publication.content?.length) {
          setContent(publication.content);
          persistSelectedId(publication.content.some((item) => item.id === selectedId) ? selectedId : publication.content[0]?.id ?? "");
        }
        setCloudVersion(publication.version);
        setCloudReady(true);
        if (window.sessionStorage.getItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY) === "active" && readAuthorToken()) setIsAuthor(true);
      } catch (error) {
        if (!active) return;
        setCloudReady(false);
        toast.error(error instanceof ContentApiError ? error.message : "云端内容暂时无法加载，请稍后再试。");
      }
    };
    void restoreCloudContent();
    return () => { active = false; };
  }, [cloudSyncEnabled]);

  useEffect(() => {
    if (content.length && !content.some((item) => item.id === selectedId)) persistSelectedId(content[0]?.id ?? "");
  }, [content, selectedId]);

  const selectedItem = content.find((item) => item.id === selectedId) ?? content[0];
  const draftMarkdownHtml = useMemo(() => renderMarkdown(draft.markdown), [draft.markdown]);
  const partOptions = useMemo(() => Array.from(new Set([...partOrder, ...content.map((item) => item.part)])).filter(Boolean), [content]);
  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return content.filter((item) => {
      const matchesPart = partFilter === "all" || item.part === partFilter;
      const matchesKeyword = !keyword || [item.part, item.number, item.title, item.markdown].join(" ").toLowerCase().includes(keyword);
      return matchesPart && matchesKeyword;
    });
  }, [content, partFilter, query]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(makeDraft());
  };

  const openEdit = (item: ContentItem) => {
    persistSelectedId(item.id);
    setEditingId(item.id);
    setDraft({ part: item.part, number: item.number, title: item.title, kind: item.kind, markdown: item.markdown });
    window.setTimeout(() => editorRef.current?.focus(), 0);
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
    setDraft((value) => ({ ...value, markdown: `${value.markdown.slice(0, start)}${opening}${selectedText}${closing}${value.markdown.slice(end)}` }));
    restoreEditorSelection(start + opening.length, start + opening.length + selectedText.length);
  };

  const insertBlock = (block: string) => {
    const textarea = editorRef.current;
    const start = textarea?.selectionStart ?? draft.markdown.length;
    const end = textarea?.selectionEnd ?? start;
    const prefix = start > 0 && !draft.markdown.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    const suffix = end < draft.markdown.length && !draft.markdown.slice(end).startsWith("\n\n") ? "\n\n" : "";
    setDraft((value) => ({ ...value, markdown: `${value.markdown.slice(0, start)}${prefix}${block}${suffix}${value.markdown.slice(end)}` }));
    const cursor = start + prefix.length + block.length;
    restoreEditorSelection(cursor, cursor);
  };

  const selectImageFile = (file: File | null) => {
    if (!file) return;
    if (!cloudSyncEnabled) {
      toast.error("当前环境未启用云端同步，无法向所有访客共享图片。");
      return;
    }
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      toast.error("仅支持 JPG、PNG 或 WebP 图片。");
      return;
    }
    if (!file.size || file.size > MAXIMUM_CONTENT_IMAGE_BYTES) {
      toast.error("图片大小需在 2.5 MB 以内。");
      return;
    }
    setPendingImage(file);
    setImageAlt(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  };

  const uploadAndInsertImage = async () => {
    if (!pendingImage) {
      toast.error("请先选择一张图片。");
      return;
    }
    setImageUploading(true);
    try {
      const uploaded = await uploadContentImage(pendingImage);
      const alt = (imageAlt.trim() || pendingImage.name.replace(/\.[^.]+$/, "图像")).replace(/[\[\]\n]/g, " ");
      insertBlock(`![${alt}](${uploaded.url})`);
      setPendingImage(null);
      setImageAlt("");
      if (imageInputRef.current) imageInputRef.current.value = "";
      toast.success("图片已上传并插入正文；请保存并发布章节。" );
    } catch (error) {
      toast.error(error instanceof ContentApiError ? error.message : "图片上传失败，请稍后重试。");
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.markdown.trim()) {
      toast.error("请填写章节标题与正文后再保存。");
      return;
    }
    const next: ContentItem = {
      ...draft,
      id: editingId ?? crypto.randomUUID(),
      part: draft.part.trim() || "我的实践笔记",
      number: draft.number.trim() || "自定义",
      title: draft.title.trim(),
      markdown: draft.markdown.trim(),
      modifiedAt: `${cloudSyncEnabled ? "云端发布" : "个人版本"} · ${formatToday()}`,
      isCustom: !editingId || content.find((item) => item.id === editingId)?.isCustom === true,
    };
    const nextContent = editingId ? content.map((item) => (item.id === editingId ? next : item)) : [...content, next];
    if (!(await persistContent(nextContent))) return;
    persistSelectedId(next.id);
    setEditingId(next.id);
    toast.success(cloudSyncEnabled ? "本节已保存并发布，访客刷新后即可查看。" : "本节已加密保存到当前浏览器。");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const nextContent = content.filter((item) => item.id !== pendingDelete.id);
    if (!(await persistContent(nextContent))) return;
    if (pendingDelete.id === selectedId) persistSelectedId(nextContent[0]?.id ?? "");
    if (editingId === pendingDelete.id) openCreate();
    toast.success(cloudSyncEnabled ? `已发布删除「${pendingDelete.title}」。` : `已移除「${pendingDelete.title}」。`);
    setPendingDelete(null);
  };

  const resetContent = async () => {
    if (!window.confirm("恢复原始教程会覆盖当前全部编辑与新增内容，是否继续？")) return;
    const restored = copyInitialContent();
    if (!(await persistContent(restored))) return;
    persistSelectedId(restored[0]?.id ?? "");
    openCreate();
    toast.success("已恢复基础教程 V0.1。");
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
      if (cloudSyncEnabled && !cloudReady) {
        setAuthorError("云端内容尚未准备就绪，请稍后再试。");
        return;
      }
      if (await hashAuthorCode(authorCode.trim()) !== AUTHOR_ACCESS_HASH) {
        setAuthorError("访问码不正确，请重新输入。");
        return;
      }
      const privateContentKey = await derivePrivateContentKey(authorCode.trim());
      privateContentKeyRef.current = privateContentKey;
      if (cloudSyncEnabled) await startAuthorSession(authorCode.trim());
      await saveAuthorSessionKey(privateContentKey);
      window.sessionStorage.setItem(AUTHOR_SESSION_FLAG_KEY, "active");
      window.sessionStorage.setItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY, "active");
      if (!cloudSyncEnabled) {
        const restored = await hydratePrivateContent(privateContentKey);
        setContent(restored);
        persistSelectedId(restored.some((item) => item.id === selectedId) ? selectedId : restored[0]?.id ?? "");
      }
      setIsAuthor(true);
      setAuthorCode("");
      toast.success("作者工作台已解锁。");
    } catch {
      setAuthorError("当前浏览器无法验证访问码，请刷新页面后重试。");
    } finally {
      setAuthorBusy(false);
    }
  };

  const exitAuthorMode = async () => {
    privateContentKeyRef.current = null;
    clearAuthorToken();
    window.sessionStorage.removeItem(AUTHOR_SESSION_FLAG_KEY);
    window.sessionStorage.removeItem(AUTHOR_MANAGEMENT_SESSION_FLAG_KEY);
    await clearAuthorSessionKey().catch(() => undefined);
    setIsAuthor(false);
    setLocation("/");
  };

  if (!isAuthor) {
    return (
      <main className="author-gate min-h-screen">
        <div className="paper-grain pointer-events-none fixed inset-0" aria-hidden="true" />
        <div className="author-gate-shell relative z-10">
          <aside className="author-gate-rail hidden border-r border-[#20201d]/10 bg-[#ebe5d8]/84 px-7 py-8 lg:flex lg:flex-col">
            <Link href="/" className="brand-lockup masthead flex items-center gap-3" aria-label="返回公开阅读页"><span className="brand-mark"><img src={staticAssetUrl("agent-book-mark.webp")} alt="" /></span><span><span className="brand-kicker">THE PRACTICAL GUIDE</span><span className="brand-name">Agent小黄书</span></span></Link>
            <div className="author-gate-dossier"><p className="rail-label">受控编辑插页</p><strong>01 / AUTHOR KEY</strong><span>本页仅用于整理章节、发布修订与交付内容。</span></div>
            <div className="author-gate-steps"><div><i>01</i><span>验证作者访问码</span></div><div><i>02</i><span>整理章节与排版</span></div><div><i>03</i><span>发布可读版本</span></div></div>
            <Link href="/" className="text-link mt-auto"><ChevronLeft size={16} /> 回到公开手册</Link>
          </aside>
          <section className="author-gate-stage px-5 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16" aria-labelledby="author-gate-title">
            <Link href="/" className="author-gate-mobile-brand brand-lockup masthead flex items-center gap-3 lg:hidden" aria-label="返回公开阅读页"><span className="brand-mark"><img src={staticAssetUrl("agent-book-mark.webp")} alt="" /></span><span><span className="brand-kicker">THE PRACTICAL GUIDE</span><span className="brand-name">Agent小黄书</span></span></Link>
            <section className="author-gate-card mt-12 w-full max-w-[740px] bg-[#f7f3eb] p-7 shadow-2xl sm:p-10 lg:mt-0 lg:p-12">
              <div className="author-gate-card-head"><div className="author-gate-mark"><LockKeyhole size={20} /></div><div><p className="eyebrow">CONTROLLED EDIT INSERT</p><p className="author-gate-serial">EDITION 0.1 · AUTHOR ACCESS · 01</p></div></div>
              <div className="author-gate-title-row"><span>01</span><div><h1 id="author-gate-title" className="workspace-title">解锁后整理章节</h1><p>验证访问码，即可集中维护内容、调整排版、发布修订并导出交付成果。</p></div></div>
              <div className="author-gate-rule" aria-hidden="true" />
              <form onSubmit={unlockAuthorMode} className="author-gate-form">
                <label className="form-field"><span>AUTHOR ACCESS CODE</span><input type="password" value={authorCode} onChange={(event) => { setAuthorCode(event.target.value); setAuthorError(""); }} placeholder="输入作者访问码以继续" autoFocus /></label>
                {authorError && <p className="author-error" role="alert">{authorError}</p>}
                <div className="author-gate-meta"><div><span>存储边界</span><strong>{cloudSyncEnabled ? "修订将发布至云端" : "本地修订使用 AES-GCM 加密"}</strong></div><div><span>内容权限</span><strong>访客始终仅可阅读</strong></div></div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#20201d]/10 pt-6"><Link href="/" className="text-link"><ChevronLeft size={16} /> 继续公开阅读</Link><button type="submit" className="top-action top-action-primary" disabled={authorBusy}><LockKeyhole size={16} /> {authorBusy ? "正在验证访问码" : "验证并整理内容"}</button></div>
              </form>
            </section>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="author-workspace min-h-screen bg-[#f4f0e7] text-[#20201d]">
      <div className="paper-grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <header className="workspace-topbar relative z-10 border-b border-[#20201d]/12 bg-[#f4f0e7]/94 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-4">
          <div><p className="eyebrow">{cloudSyncEnabled ? "CLOUD PUBLISHING DESK" : "LOCAL ENCRYPTED DESK"}</p><h1 className="workspace-title mt-1">作者内容工作台</h1></div>
          <div className="flex flex-wrap items-center gap-2"><Link href="/" className="top-action"><BookOpen size={16} /> 公开阅读页</Link><button type="button" className="author-status" onClick={() => void exitAuthorMode()}><LogOut size={15} /> 退出作者模式</button></div>
        </div>
      </header>

      <main className="workspace-layout relative z-10 mx-auto max-w-[1700px] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <aside className="workspace-catalog">
          <div className="workspace-panel-head"><div><p className="eyebrow">CHAPTER CATALOG</p><h2>章节总览</h2></div><span>{content.length} 节</span></div>
          <div className="workspace-stats"><div><strong>{content.length}</strong><span>内容单元</span></div><div><strong>{partOptions.length}</strong><span>篇章分类</span></div><div><strong>{cloudSyncEnabled ? "云端" : "本地"}</strong><span>{cloudSyncEnabled ? "已连接" : "已加密"}</span></div></div>
          <label className="workspace-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选章节标题或正文" aria-label="筛选章节标题或正文" /></label>
          <label className="workspace-select"><span>按篇章筛选</span><select value={partFilter} onChange={(event) => setPartFilter(event.target.value)}><option value="all">全部篇章</option>{partOptions.map((part) => <option value={part} key={part}>{part}</option>)}</select></label>
          <div className="workspace-list" aria-label="章节列表">
            {visibleItems.map((item) => <button type="button" key={item.id} className={`workspace-item ${selectedItem?.id === item.id ? "is-current" : ""}`} onClick={() => openEdit(item)}><span>{displayNumber(item)}</span><strong>{item.title}</strong><small>{item.part}</small></button>)}
            {!visibleItems.length && <p className="workspace-empty">没有匹配的章节。</p>}
          </div>
          <button type="button" onClick={resetContent} className="rail-reset mt-5"><RotateCcw size={14} /> 恢复原始教程全文</button>
        </aside>

        <section className="workspace-editor" aria-label="章节编辑器">
          <div className="workspace-panel-head"><div><p className="eyebrow">{editingId ? "EDITING CHAPTER" : "NEW CHAPTER"}</p><h2>{editingId ? "编辑与发布" : "新增内容"}</h2></div><button type="button" onClick={openCreate} className="add-content-button"><FilePlus2 size={16} /> 新建章节</button></div>
          <div className="workspace-notice"><CloudUpload size={16} /><p>{cloudSyncEnabled ? "每次保存都会直接发布为公共阅读版本。请在右侧预览确认排版。" : "每次保存都会使用当前作者会话密钥加密保存在浏览器中。"}</p></div>
          <form onSubmit={handleSave} className="workspace-form">
            <div className="form-grid"><label><span>归属篇章</span><input value={draft.part} onChange={(event) => setDraft((value) => ({ ...value, part: event.target.value }))} placeholder="例如：我的实践笔记" /></label><label><span>章节索引</span><input value={draft.number} onChange={(event) => setDraft((value) => ({ ...value, number: event.target.value }))} placeholder="例如：25 或 附F" /></label></div>
            <label className="form-field"><span>章节标题</span><input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="写清这节内容要解决的问题" /></label>
            <div className="form-field"><span>正文与排版</span><div className="editor-toolbar" role="toolbar" aria-label="文本排版工具"><span className="toolbar-label">选中文字后操作</span><button type="button" onClick={() => wrapSelectedText("**", "**", "重点文字")} aria-label="加粗文字"><strong>B</strong></button><button type="button" onClick={() => wrapSelectedText("*", "*", "强调文字")} aria-label="斜体文字"><em>I</em></button><button type="button" onClick={() => insertBlock("## 小节标题")} aria-label="插入二级标题">H2</button><button type="button" onClick={() => insertBlock("> 这里填写提示、注释或重要结论。")} aria-label="插入引用提示">引用</button><span className="toolbar-divider" /><button type="button" onClick={() => wrapSelectedText("{{size:small}}", "{{/size}}", "较小文字")} aria-label="缩小字号">小</button><button type="button" onClick={() => wrapSelectedText("{{size:large}}", "{{/size}}", "较大文字")} aria-label="放大字号">大</button><button type="button" onClick={() => wrapSelectedText("{{size:xl}}", "{{/size}}", "重点大字")} aria-label="最大字号">特大</button><span className="toolbar-divider" /><button type="button" className="color-orange" onClick={() => wrapSelectedText("{{color:orange}}", "{{/color}}", "橙皮朱文字")} aria-label="设为橙皮朱">橙</button><button type="button" className="color-ink" onClick={() => wrapSelectedText("{{color:ink}}", "{{/color}}", "深墨文字")} aria-label="设为深墨">墨</button><button type="button" className="color-blue" onClick={() => wrapSelectedText("{{color:blue}}", "{{/color}}", "蓝灰文字")} aria-label="设为蓝灰">蓝</button><button type="button" className="color-green" onClick={() => wrapSelectedText("{{color:green}}", "{{/color}}", "深绿文字")} aria-label="设为深绿">绿</button><span className="toolbar-divider" /><button type="button" onClick={() => insertBlock("| 项目 | 说明 | 备注 |\n| --- | --- | --- |\n| 内容 | 在此填写 | 在此填写 |")} aria-label="插入表格">表格</button><button type="button" onClick={() => insertBlock("```ts\nconst message = '在这里写代码';\nconsole.log(message);\n```")} aria-label="插入代码块">代码</button></div><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectImageFile(event.target.files?.[0] ?? null)} /><div className="editor-image-upload"><div><span className="eyebrow">IMAGE INSERT</span><p>{pendingImage ? `已选择：${pendingImage.name}` : cloudSyncEnabled ? "上传 JPG、PNG 或 WebP（单张不超过 2.5 MB），随后插入当前光标。" : "公开云端同步启用后，可在此上传共享图片。"}</p></div><button type="button" className="top-action" onClick={() => imageInputRef.current?.click()} disabled={!cloudSyncEnabled || imageUploading}><ImagePlus size={16} /> 选择图片</button>{pendingImage && <><input value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} aria-label="图片替代文本" placeholder="图片说明（建议填写）" /><button type="button" className="top-action top-action-primary" onClick={() => void uploadAndInsertImage()} disabled={imageUploading}>{imageUploading ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />} {imageUploading ? "正在上传" : "上传并插入"}</button></>}</div><textarea ref={editorRef} rows={23} value={draft.markdown} onChange={(event) => setDraft((value) => ({ ...value, markdown: event.target.value }))} placeholder="可使用工具栏插入标题、表格、代码块、图片、字号与文字颜色；也支持直接编辑 Markdown。" /></div>
            <div className="workspace-form-footer"><label className="workspace-kind"><span>内容类型</span><select value={draft.kind} onChange={(event) => setDraft((value) => ({ ...value, kind: event.target.value as ContentItem["kind"] }))}><option value="chapter">正式章节</option><option value="supplement">导读或补充</option><option value="appendix">附录</option><option value="introduction">前言</option></select></label><div className="flex flex-wrap justify-end gap-2">{editingId && <button type="button" onClick={() => selectedItem && setPendingDelete(selectedItem)} className="delete-button"><Trash2 size={16} /> 删除</button>}<button type="submit" className="top-action top-action-primary"><Check size={16} /> {cloudSyncEnabled ? "保存并发布" : "加密保存"}</button></div></div>
          </form>
        </section>

        <aside className="workspace-preview" aria-label="实时阅读预览"><div className="workspace-panel-head"><div><p className="eyebrow">LIVE READER PREVIEW</p><h2>发布前预览</h2></div><FileText size={18} /></div><div className="preview-meta"><span>{draft.part || "未归类"}</span><strong>{draft.title || "尚未命名的章节"}</strong></div><div className="workspace-preview-paper"><div className="markdown-body compact" dangerouslySetInnerHTML={{ __html: draftMarkdownHtml }} /></div><p className="workspace-preview-note"><LayoutList size={14} /> 该版式会同步用于公开阅读、复制和 PDF 导出。</p></aside>
      </main>

      {pendingDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-[#20201d]/45 p-5 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="workbench-delete-title"><div className="delete-dialog w-full max-w-md bg-[#f7f3eb] p-7 shadow-2xl"><div className="flex items-start justify-between gap-4"><span className="delete-icon"><Trash2 size={19} /></span><button type="button" onClick={() => setPendingDelete(null)} className="icon-button" aria-label="关闭删除确认"><X size={19} /></button></div><p className="eyebrow mt-6">{cloudSyncEnabled ? "不可撤销的云端发布" : "不可撤销的本地修改"}</p><h2 id="workbench-delete-title" className="mt-2 font-serif text-2xl font-bold">确定移除这一节？</h2><p className="mt-3 leading-7 text-[#20201d]/66">{cloudSyncEnabled ? `「${pendingDelete.title}」会从所有访客读取的已发布手册中删除。` : `「${pendingDelete.title}」会从当前浏览器保存的手册中删除。`}</p><div className="mt-7 flex justify-end gap-2"><button type="button" onClick={() => setPendingDelete(null)} className="top-action">保留内容</button><button type="button" onClick={() => void confirmDelete()} className="delete-button"><Trash2 size={16} /> 确认删除</button></div></div></div>}
    </div>
  );
}
