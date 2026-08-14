import type { ContentItem } from "@/lib/tutorial-content";

export const LEGACY_STORAGE_KEY = "agent-xiaohuangshu-full-tutorial-v2";
export const ENCRYPTED_PRIVATE_STORAGE_KEY = "agent-xiaohuangshu-private-content-v1";
export const SELECTED_STORAGE_KEY = "agent-xiaohuangshu-selected-section-v2";
export const AUTHOR_SESSION_FLAG_KEY = "agent-xiaohuangshu-author-session-v1";
export const AUTHOR_MANAGEMENT_SESSION_FLAG_KEY = "agent-xiaohuangshu-author-management-session-v1";
export const AUTHOR_ACCESS_HASH = "4fab72f10f9af19496f6d9d50065b2c7bdbea3ec642685017c310ff1e8cd1198";

const CONTENT_ENCRYPTION_SALT = "agent-xiaohuangshu-private-content-v1";

export type EncryptedPrivatePayload = { version?: 1 | 2; iv: string; cipher: string };

export const hashAuthorCode = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export const derivePrivateContentKey = async (authorCode: string) => {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(authorCode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: new TextEncoder().encode(CONTENT_ENCRYPTION_SALT), iterations: 150000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};

export const encryptPrivateSnapshot = async (content: ContentItem[], key: CryptoKey): Promise<EncryptedPrivatePayload> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { version: 2, iv: bytesToBase64(iv), cipher: bytesToBase64(new Uint8Array(cipher)) };
};

export const decryptPrivateSnapshot = async (payload: EncryptedPrivatePayload, key: CryptoKey): Promise<ContentItem[]> => {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(payload.iv) }, key, base64ToBytes(payload.cipher));
  const parsed = JSON.parse(new TextDecoder().decode(plaintext));
  return Array.isArray(parsed) ? (parsed as ContentItem[]) : [];
};
