type IDBPayload = {
  key: string;
  value: unknown;
};

export function idbOpen(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(
  dbName: string,
  storeName: string,
  key: string,
  value: unknown
) {
  const db = await idbOpen(dbName, storeName);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(storeName).put({ key, value } satisfies IDBPayload);
  });
  db.close();
}

export async function idbGet<T>(
  dbName: string,
  storeName: string,
  key: string
): Promise<T | undefined> {
  const db = await idbOpen(dbName, storeName);
  const result = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () =>
      resolve((req.result?.value ?? undefined) as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
