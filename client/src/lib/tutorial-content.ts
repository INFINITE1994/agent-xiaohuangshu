import { tutorialSections, type TutorialSection } from "@/data/tutorial";

export type ContentItem = TutorialSection & {
  modifiedAt: string;
  isCustom: boolean;
};

export type Draft = Pick<ContentItem, "part" | "number" | "title" | "kind" | "markdown">;

export const initialContent: ContentItem[] = tutorialSections.map((section) => ({
  ...section,
  modifiedAt: "基础版本 · V0.1",
  isCustom: false,
}));

export const partOrder = Array.from(new Set(initialContent.map((item) => item.part)));

export const makeDraft = (): Draft => ({
  part: "我的实践笔记",
  number: "自定义",
  title: "",
  kind: "supplement",
  markdown: "# 新的实践笔记\n\n从这里开始记录你的方法、案例或补充说明。",
});

export const copyInitialContent = () => initialContent.map((item) => ({ ...item }));

export const mergePrivateOverrides = (overrides: ContentItem[]) => {
  const overrideById = new Map(overrides.map((item) => [item.id, item]));
  const publicItems = copyInitialContent().map((item) => overrideById.get(item.id) ?? item);
  const customItems = overrides.filter((item) => !initialContent.some((source) => source.id === item.id));
  return [...publicItems, ...customItems];
};

export const excerpt = (markdown: string) => {
  const paragraph = markdown
    .split("\n")
    .map((line) => line.replace(/^\s*(>|#|-|\d+\.)\s*/, "").replace(/[*`|]/g, "").trim())
    .find((line) => line.length > 24 && !line.startsWith("---"));
  return paragraph ? `${paragraph.slice(0, 82)}${paragraph.length > 82 ? "…" : ""}` : "阅读本节教程正文";
};

export const displayNumber = (item: ContentItem) => {
  if (item.number.startsWith("附")) return item.number;
  if (item.number === "结语" || item.number === "自定义") return item.number;
  return item.number.padStart(2, "0");
};
