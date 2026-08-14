import type { ContentItem } from "@/lib/tutorial-content";

const AUTHOR_TOKEN_KEY = "agent-xiaohuangshu-cloud-author-token-v1";

export type PublishedContent = {
  content: ContentItem[] | null;
  version: number;
  publishedAt: string | null;
};

export type UploadedContentImage = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

export const MAXIMUM_CONTENT_IMAGE_BYTES = 2.5 * 1024 * 1024;

export class ContentApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const getContentApiUrl = () => (import.meta.env.VITE_CONTENT_API_URL ?? "").trim().replace(/\/$/, "");
export const isCloudSyncEnabled = () => Boolean(getContentApiUrl());
export const readAuthorToken = () => window.sessionStorage.getItem(AUTHOR_TOKEN_KEY) ?? "";
export const clearAuthorToken = () => window.sessionStorage.removeItem(AUTHOR_TOKEN_KEY);

async function request<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getContentApiUrl()}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ContentApiError(payload.error ?? "云端内容服务暂时不可用。", response.status);
  return payload as T;
}

export const fetchPublishedContent = () => request<PublishedContent>("/v1/content");

export const startAuthorSession = async (accessCode: string) => {
  const payload = await request<{ token: string }>("/v1/author/session", {
    method: "POST",
    body: JSON.stringify({ accessCode }),
  });
  window.sessionStorage.setItem(AUTHOR_TOKEN_KEY, payload.token);
};

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("无法读取图片文件。"));
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : "";
      if (!base64) reject(new Error("图片内容无效。"));
      else resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export const uploadContentImage = async (file: File) => {
  if (!isCloudSyncEnabled()) throw new ContentApiError("当前未启用云端同步，无法共享图片。", 400);
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
    throw new ContentApiError("仅支持 JPG、PNG 或 WebP 图片。", 400);
  }
  if (!file.size || file.size > MAXIMUM_CONTENT_IMAGE_BYTES) {
    throw new ContentApiError("图片大小需在 2.5 MB 以内。", 400);
  }
  return request<UploadedContentImage>("/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${readAuthorToken()}` },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: await readFileAsBase64(file) }),
  });
};

export const publishContent = (content: ContentItem[], expectedVersion: number) => request<PublishedContent>("/v1/content", {
  method: "PUT",
  headers: { Authorization: `Bearer ${readAuthorToken()}` },
  body: JSON.stringify({ content, expectedVersion }),
});
