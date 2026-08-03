// Framework-free translation engine. Wraps Chrome's on-device Translator API
// (https://developer.chrome.com/docs/ai/translator-api) behind a synchronous
// cache, so callers always have *something* to render immediately and get the
// real translation once it lands.
//
// `Translator` exists only in desktop Chrome 138+ — nowhere under vitest,
// which is also the "unsupported browser" case in production (Firefox,
// Safari, every mobile browser). Every path here must degrade to the original
// text rather than throw.

export type TranslationStatus = 'unsupported' | 'idle' | 'downloading' | 'ready' | 'error';

export const SOURCE_LANGUAGE = 'pl';

const CACHE_STORAGE_KEY = 'go-to-city.mt';

interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy(): void;
}

interface TranslatorDownloadProgressEvent {
  loaded: number;
}

interface TranslatorMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: TranslatorDownloadProgressEvent) => void
  ): void;
}

interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?(monitor: TranslatorMonitor): void;
}

interface TranslatorAvailabilityOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslatorStatic {
  create(options: TranslatorCreateOptions): Promise<TranslatorInstance>;
  availability(options: TranslatorAvailabilityOptions): Promise<string>;
}

declare global {
  // Absent everywhere but desktop Chrome 138+; every read must go through
  // `getTranslatorApi()`, never a module-load-time capture, since tests
  // install and remove this after the module is imported.
  var Translator: TranslatorStatic | undefined;
}

/** Read off `globalThis` at call time — never captured at module load. */
function getTranslatorApi(): TranslatorStatic | undefined {
  return globalThis.Translator;
}

// --- cache -------------------------------------------------------------

// Module-level cache, mirrored into sessionStorage so paging through a list
// and coming back does not re-translate. Not localStorage: machine
// translations are not worth persisting across sessions.
let cache = new Map<string, string>();
let sessionStorageLoaded = false;

function cacheKey(target: string, text: string): string {
  return `${SOURCE_LANGUAGE}|${target}|${text}`;
}

// Lazy, one-shot load from sessionStorage. Never called from `read`, which
// must stay pure — only from `request`/`primeTranslator`, which already do
// I/O and scheduling.
function ensureCacheLoaded(): void {
  if (sessionStorageLoaded) return;
  sessionStorageLoaded = true;
  let loadedAny = false;
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Record<string, string>;
      for (const [key, value] of Object.entries(stored)) {
        cache.set(key, value);
        loadedAny = true;
      }
    }
  } catch {
    // sessionStorage throws in private mode, and a corrupt payload is not
    // worth crashing over — the cache just starts empty.
  }
  // A prior session's translations just became available; anything already
  // rendered from the fallback text should get a chance to pick them up.
  if (loadedAny) notify();
}

function persistEntry(key: string, value: string): void {
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    stored[key] = value;
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Quota exceeded or private mode — a translation failing to persist is
    // not worth an error; it just gets requested again next session.
  }
}

// --- subscribers ---------------------------------------------------------

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// --- status ----------------------------------------------------------------

let status: TranslationStatus = 'idle';

function setStatus(next: TranslationStatus): void {
  if (status === next) return;
  status = next;
  notify();
}

export function isTranslationSupported(): boolean {
  return Boolean(getTranslatorApi());
}

export function getStatus(): TranslationStatus {
  if (!isTranslationSupported()) return 'unsupported';
  return status;
}

// --- translator lifecycle ---------------------------------------------------

let translatorInstance: TranslatorInstance | null = null;
let translatorTarget: string | null = null;
let translatorPromise: Promise<TranslatorInstance> | null = null;

// Deliberately shallow: one await from `api.create(...)` to a settled
// instance, no intervening async function boundary. Each extra `await`
// hop here delays the microtask flush by a full tick, and the whole point
// of the queue is that fifteen cards resolve within the same flush.
async function ensureTranslator(target: string): Promise<TranslatorInstance | null> {
  const api = getTranslatorApi();
  if (!api) return null;

  if (translatorInstance && translatorTarget === target) {
    return translatorInstance;
  }

  if (translatorTarget !== target) {
    // Switching target languages invalidates whatever was in flight or
    // created for the previous one.
    translatorInstance = null;
    translatorPromise = null;
    translatorTarget = target;
  }

  if (!translatorPromise) {
    translatorPromise = api.create({
      sourceLanguage: SOURCE_LANGUAGE,
      targetLanguage: target,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          if (event.loaded < 1) {
            setStatus('downloading');
          }
        });
      },
    });
  }

  try {
    const instance = await translatorPromise;
    translatorInstance = instance;
    setStatus('ready');
    return instance;
  } catch {
    translatorInstance = null;
    translatorPromise = null;
    setStatus('error');
    return null;
  }
}

/** Create the translator. Call from a user gesture — a model download needs activation. */
export async function primeTranslator(target: string): Promise<void> {
  ensureCacheLoaded();
  await ensureTranslator(target);
}

// --- reads and requests ------------------------------------------------

/** Cached translation, or the original text when there is none yet. Never throws, never async. */
export function read(text: string, target: string): string {
  if (!text) return text;
  if (target === SOURCE_LANGUAGE) return text;
  return cache.get(cacheKey(target, text)) ?? text;
}

const pendingEntries = new Map<string, { text: string; target: string }>();

function scheduleFlush(): void {
  queueMicrotask(() => {
    void flushQueue();
  });
}

/** Queue a miss. Requests in one microtask flush as a single batch. */
export function request(text: string, target: string): void {
  if (!text || !text.trim()) return;
  if (target === SOURCE_LANGUAGE) return;

  ensureCacheLoaded();

  const key = cacheKey(target, text);
  if (cache.has(key)) return;
  if (pendingEntries.has(key)) return;

  if (pendingEntries.size === 0) scheduleFlush();
  pendingEntries.set(key, { text, target });
}

async function translateBatch(translator: TranslatorInstance, target: string, texts: string[]): Promise<void> {
  await Promise.all(
    texts.map(async (text) => {
      try {
        const result = await translator.translate(text);
        const key = cacheKey(target, text);
        cache.set(key, result);
        persistEntry(key, result);
      } catch {
        // A single failure must not abandon the batch — leave the original.
      }
    })
  );
}

async function flushQueue(): Promise<void> {
  if (pendingEntries.size === 0) return;

  const entries = Array.from(pendingEntries.values());
  pendingEntries.clear();

  const byTarget = new Map<string, string[]>();
  for (const { text, target } of entries) {
    const texts = byTarget.get(target);
    if (texts) {
      texts.push(text);
    } else {
      byTarget.set(target, [text]);
    }
  }

  await Promise.all(
    Array.from(byTarget.entries()).map(async ([target, texts]) => {
      const translator = await ensureTranslator(target);
      if (!translator) return;
      await translateBatch(translator, target, texts);
    })
  );

  notify();
}

// --- test seam ---------------------------------------------------------

/** Drops the cache, the queue, the translator and the status. */
export function resetTranslationEngine(): void {
  cache = new Map();
  sessionStorageLoaded = false;
  pendingEntries.clear();
  translatorInstance = null;
  translatorTarget = null;
  translatorPromise = null;
  status = 'idle';
  listeners.clear();
  try {
    sessionStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
