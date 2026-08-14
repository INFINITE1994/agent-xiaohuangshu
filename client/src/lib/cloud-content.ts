import type { ContentItem } from "@/lib/tutorial-content";

const AUTHOR_TOKEN_KEY = "agent-xiaohuangshu-cloud-author-token-v1";

export type PublishedContent = {
  content: ContentItem[] | null;
  version: number;
  publishedAt: string | null;
};

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

export const publishContent = (content: ContentItem[], expectedVersion: number) => request<PublishedContent>("/v1/content", {
  method: "PUT",
  headers: { Authorization: `Bearer ${readAuthorToken()}` },
  body: JSON.stringify({ content, expectedVersion }),
});
