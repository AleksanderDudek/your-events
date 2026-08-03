const MIX_SEED_STORAGE_KEY = 'go-to-city.mixSeed';

/**
 * The default list samples this many events per category so the first screen
 * cannot be dominated by whichever category happens to have the most rows —
 * gym classes and cinema screenings alone are 519 of 748 events.
 */
export const MIX_PER_CATEGORY = 3;

// mulberry32: a tiny, dependency-free PRNG. Deterministic for a given seed and
// good enough to shuffle a handful of category buckets — this is not
// cryptography, it is "don't show the same order twice in one session".
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A seed that is stable for one browser session, so the mix does not jitter
 * on every React re-render and does not change out from under the user when
 * they navigate back. `sessionStorage` throws in private mode, hence the
 * try/catch and the random fallback — a fresh shuffle per call in that case,
 * which is a worse experience than a stable one but not a broken page.
 */
export function getMixSeed(): number {
  try {
    const stored = window.sessionStorage.getItem(MIX_SEED_STORAGE_KEY);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) return parsed;
    }
    const seed = Math.floor(Math.random() * 0xffffffff);
    window.sessionStorage.setItem(MIX_SEED_STORAGE_KEY, String(seed));
    return seed;
  } catch {
    return Math.floor(Math.random() * 0xffffffff);
  }
}

/**
 * Interleave per-category buckets into one list: shuffle the ORDER OF THE
 * BUCKETS with a seeded Fisher–Yates (the events within each bucket keep
 * whatever order the caller gave them), then round-robin across them. That
 * round-robin is the whole point — it puts one event from every category on
 * the first screen before any category gets a second, which is what makes
 * the mix a mix rather than just a reshuffled version of the same gym
 * timetable.
 */
export function buildCategoryMix<T>(buckets: T[][], seed: number): T[] {
  const random = mulberry32(seed);
  const order = buckets.map((bucket) => bucket.slice());
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const result: T[] = [];
  let remaining = order.reduce((sum, bucket) => sum + bucket.length, 0);
  let cursor = 0;
  while (remaining > 0) {
    const bucket = order[cursor % order.length];
    if (bucket.length > 0) {
      result.push(bucket.shift() as T);
      remaining--;
    }
    cursor++;
  }
  return result;
}
