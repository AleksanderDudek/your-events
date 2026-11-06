// The one record the push service worker reads. A service worker cannot read
// localStorage, so the page mirrors exactly what a reminder needs here.
// public/push-sw.js hard-codes the same three names; src/lib/pushSw.spec.ts
// writes through THIS module and reads through the worker, which is what
// keeps them in step.

export const PUSH_DB = 'idznamiasto-push';
export const PUSH_STORE = 'kv';
export const PUSH_SETTINGS_KEY = 'settings';

export interface PushSettings {
  locale: 'pl' | 'en';
  /** The marked filter: at most one. Null = the reminder opens the home page. */
  preset: { id: string; name: string } | null;
}

export function isPushSettings(value: unknown): value is PushSettings {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.locale !== 'pl' && v.locale !== 'en') return false;
  if (v.preset === null) return true;
  if (!v.preset || typeof v.preset !== 'object') return false;
  const p = v.preset as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PUSH_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(PUSH_STORE, mode);
      const req = op(tx.objectStore(PUSH_STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readPushSettings(): Promise<PushSettings | null> {
  const value = await run('readonly', (store) => store.get(PUSH_SETTINGS_KEY));
  return isPushSettings(value) ? value : null;
}

export async function writePushSettings(settings: PushSettings): Promise<void> {
  await run('readwrite', (store) => store.put(settings, PUSH_SETTINGS_KEY));
}

export async function clearPushSettings(): Promise<void> {
  await run('readwrite', (store) => store.delete(PUSH_SETTINGS_KEY));
}
