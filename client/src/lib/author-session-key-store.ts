/**
 * 作者会话密钥存储基础设施。
 * 仅保存不可导出的 CryptoKey，不保存访问码明文；页面组件通过三个最小接口访问。
 */
const DATABASE_NAME = "agent-xiaohuangshu-author-key-v1";
const STORE_NAME = "session";
const RECORD_ID = "current-key";

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = window.indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const runTransaction = async (mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest | void) => {
  const database = await openDatabase();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request && "result" in request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

export const saveAuthorSessionKey = async (key: CryptoKey) => {
  await runTransaction("readwrite", (store) => store.put(key, RECORD_ID));
};

export const loadAuthorSessionKey = async () => {
  const result = await runTransaction("readonly", (store) => store.get(RECORD_ID));
  return (result as CryptoKey | undefined) ?? null;
};

export const clearAuthorSessionKey = async () => {
  await runTransaction("readwrite", (store) => store.delete(RECORD_ID));
};
