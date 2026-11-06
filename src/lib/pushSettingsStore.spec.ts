import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PUSH_DB,
  PUSH_SETTINGS_KEY,
  PUSH_STORE,
  clearPushSettings,
  readPushSettings,
  writePushSettings,
} from './pushSettingsStore';

describe('pushSettingsStore', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('reads null when nothing was written', async () => {
    expect(await readPushSettings()).toBeNull();
  });

  it('round-trips a record', async () => {
    const settings = { locale: 'pl' as const, preset: { id: 'p1', name: 'Taniec' } };
    await writePushSettings(settings);
    expect(await readPushSettings()).toEqual(settings);
  });

  it('clears the record', async () => {
    await writePushSettings({ locale: 'en', preset: null });
    await clearPushSettings();
    expect(await readPushSettings()).toBeNull();
  });

  it('ignores a record of the wrong shape', async () => {
    await writePushSettings({ locale: 'pl', preset: null });
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open(PUSH_DB, 1);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction(PUSH_STORE, 'readwrite');
      tx.objectStore(PUSH_STORE).put({ locale: 'de', preset: 7 }, PUSH_SETTINGS_KEY);
      tx.oncomplete = () => resolve();
    });
    db.close();
    expect(await readPushSettings()).toBeNull();
  });
});
