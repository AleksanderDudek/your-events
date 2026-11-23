// Free-text search over events, in the browser.
//
// It replaced `name ILIKE '%term%' OR venue ILIKE '%term%'` in PostgREST, which
// failed the way people actually type:
//   - without Polish letters: "lodz", "wroclaw", "swieta", "zlobek";
//   - inflected: "koncerty", "w filharmonii", "spektaklu", "jazzowy";
//   - with a slip: "koncret", "filharmonja", "teart";
//   - several words, or words in different fields: "jazz filharmonia";
//   - for what something is rather than what it is called: "stand-up",
//     "kino", "dla dzieci" — words that live in the category, not the title;
//   - in English, on the English version of the site: "concert", "kids".
//
// What it does instead, all pure and tested:
//   1. Folds case and diacritics on both sides (ł → l included — NFD leaves it).
//   2. Splits into words, drops stop words ("w", "na", "dla", "the").
//   3. Every remaining query word must match some word of the event (AND), in
//      its name, venue, category or subcategory. A word matches by:
//        exact · prefix (as you type) · same stem (light Polish stemmer) ·
//        a synonym (kino ↔ film, concert → koncert) —
//      and only when none of that finds anything ANYWHERE in the corpus, by a
//      typo-tolerant match (1 edit from 4 letters, 2 from 8). Typos are the
//      fallback, not a default: "kino" must not drag in "wino".
//   4. An event whose text contains the whole query as typed (folded, four
//      letters or more) always matches too, so what the old ILIKE found by a
//      fragment ("ultikino") is not lost.
//
// The order of the input is kept: the list's own sort (date, name, price...)
// still decides what comes first.

// ── Folding and words ────────────────────────────────────────────────────────

/** Lower case, no diacritics, `ł` → `l`. The same fold for index and query. */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss');
}

const WORD_RE = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;

/**
 * The words of a folded text. A hyphenated word yields its parts and the parts
 * joined: "stand-up" → stand, up, standup — so "standup", "stand up" and
 * "stand-up" all find it.
 */
export function words(folded: string): string[] {
  const out: string[] = [];
  for (const match of folded.matchAll(WORD_RE)) {
    const parts = match[0].split(/[-'’]/).filter(Boolean);
    out.push(...parts);
    if (parts.length > 1) out.push(parts.join(''));
  }
  return out;
}

// Never a reason for an event to match or not. Polish and English, folded.
const STOP_WORDS = new Set([
  'a',
  'aby',
  'albo',
  'ale',
  'co',
  'czy',
  'dla',
  'do',
  'i',
  'jak',
  'na',
  'nad',
  'o',
  'od',
  'oraz',
  'po',
  'pod',
  'przy',
  'sie',
  'ta',
  'te',
  'to',
  'u',
  'w',
  'we',
  'z',
  'za',
  'ze',
  'an',
  'and',
  'at',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'with',
]);

// ── Stemming ─────────────────────────────────────────────────────────────────

// Consonant alternations at the end of a locative: teatr → w teatrze,
// ogród → w ogrodzie. Replaced, not just cut, so the stems meet.
const ALTERNATIONS: ReadonlyArray<[string, string]> = [
  ['rze', 'r'],
  ['dzie', 'd'],
  ['cie', 't'],
];

// Inflectional endings, longest first, folded. The adjective-forming -owy
// family goes too: jazzowy → jazz, kinowy → kin (= kino), koncertowy → koncert.
const SUFFIXES = [
  'owymi',
  'owych',
  'owego',
  'owemu',
  'owiami',
  'owej',
  'owym',
  'owie',
  'ami',
  'ach',
  'ego',
  'emu',
  'ych',
  'ymi',
  'imi',
  'ich',
  'owi',
  'owy',
  'owa',
  'owe',
  'ow',
  'om',
  'em',
  'ej',
  'ie',
  'iu',
  'ym',
  'im',
  'a',
  'e',
  'i',
  'o',
  'u',
  'y',
].sort((x, y) => y.length - x.length);

const MIN_STEM = 3;

/**
 * A light Polish stemmer: strips one inflectional ending, keeping at least
 * three letters. Not linguistics — just enough that "koncertów", "koncerty"
 * and "koncert" meet, and "filharmonii" meets "filharmonia". Input is folded.
 */
export function stem(word: string): string {
  if (/\d/.test(word)) return word;
  for (const [ending, replacement] of ALTERNATIONS) {
    if (word.endsWith(ending) && word.length - ending.length >= MIN_STEM) {
      return word.slice(0, -ending.length) + replacement;
    }
  }
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= MIN_STEM) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

// ── Typos ────────────────────────────────────────────────────────────────────

/**
 * Optimal string alignment distance (Levenshtein plus adjacent swaps), or
 * `max + 1` as soon as it is certain to exceed `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }
      row.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = row;
  }
  return prev[b.length];
}

/** How many slips a word of this length may carry. Short words: none. */
export function typoBudget(length: number): number {
  if (length >= 8) return 2;
  if (length >= 4) return 1;
  return 0;
}

// ── Synonyms ─────────────────────────────────────────────────────────────────

// Each group is one idea. A query word in a group also matches the other
// members — at the exact/prefix/stem level, never by typo. Kept to near-
// synonyms: a loose group ("klub" ~ "impreza") would let "party" match a book
// club. English words are here because the site has an English version and
// the events are written in Polish.
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['koncert', 'concert', 'gig'],
  ['muzyka', 'music'],
  ['kino', 'film', 'seans', 'cinema', 'movie'],
  // Not "spektakl": the pipeline files kids' screenings under "Spektakl / Kino
  // dla dzieci", so "teatr" would bring in every cartoon.
  ['teatr', 'theatre', 'theater'],
  ['wystawa', 'wernisaz', 'exhibition', 'gallery', 'galeria'],
  ['muzeum', 'museum'],
  ['sztuka', 'art'],
  ['dzieci', 'dziecko', 'rodzina', 'rodzinny', 'kids', 'children', 'family'],
  ['warsztaty', 'workshop'],
  ['impreza', 'party', 'clubbing'],
  ['taniec', 'dance', 'dancing'],
  ['joga', 'yoga'],
  ['wyklad', 'prelekcja', 'lecture', 'talk'],
  ['literatura', 'ksiazka', 'book'],
  ['kabaret', 'standup', 'comedy'],
  ['festiwal', 'festival'],
  ['targi', 'jarmark', 'fair', 'market'],
  ['zwiedzanie', 'spacer', 'tour', 'sightseeing'],
  ['kulinarne', 'gotowanie', 'cooking'],
  ['swieta', 'swiateczny', 'bozonarodzeniowy', 'wigilijny', 'christmas'],
];

const SYNONYMS: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const member of group) {
      const others = group.filter((m) => m !== member);
      for (const key of new Set([member, stem(member)])) {
        map.set(key, [...(map.get(key) ?? []), ...others]);
      }
    }
  }
  return map;
})();

export function synonymsOf(word: string): readonly string[] {
  return SYNONYMS.get(word) ?? SYNONYMS.get(stem(word)) ?? [];
}

// ── The query ────────────────────────────────────────────────────────────────

export interface ParsedQuery {
  /** The whole query, folded, single-spaced. Matched as a substring too. */
  phrase: string;
  /** The words every match must contain, folded, stop words out. */
  terms: string[];
}

export function parseQuery(query: string): ParsedQuery {
  const phrase = fold(query).replace(/\s+/g, ' ').trim();
  const all = [...new Set(words(phrase))];
  // A query of nothing but stop words ("to", "w") still means something.
  const meaningful = all.filter((w) => !STOP_WORDS.has(w) && (w.length > 1 || /\d/.test(w)));
  return { phrase, terms: meaningful.length > 0 ? meaningful : all };
}

/** Whether a query asks for anything at all ("  ", "!!!" do not). */
export function isSearchQuery(query: string): boolean {
  return parseQuery(query).terms.length > 0;
}

// ── The index ────────────────────────────────────────────────────────────────

interface Index {
  /** Folded text of each document, for the whole-phrase match. */
  texts: string[];
  /** Every distinct word → the documents (by position) that contain it. */
  postings: Map<string, number[]>;
  /** Each distinct word's stem. */
  stems: Map<string, string>;
}

function buildIndex(fieldTexts: readonly (readonly string[])[]): Index {
  const texts: string[] = [];
  const postings = new Map<string, number[]>();
  const stems = new Map<string, string>();
  fieldTexts.forEach((fields, position) => {
    const text = fold(fields.filter(Boolean).join(' \u0001 '));
    texts.push(text);
    for (const word of new Set(words(text))) {
      const list = postings.get(word);
      if (list) list.push(position);
      else {
        postings.set(word, [position]);
        stems.set(word, stem(word));
      }
    }
  });
  return { texts, postings, stems };
}

/** The indexed words a query word stands for without any typo. */
function closeMatches(index: Index, term: string): string[] {
  const termStem = stem(term);
  const numeric = /\d/.test(term);
  const out: string[] = [];
  for (const [word, wordStem] of index.stems) {
    if (
      word === term ||
      (term.length >= 2 && word.startsWith(term)) ||
      (!numeric && termStem.length >= MIN_STEM && wordStem === termStem) ||
      (!numeric && termStem.length >= 5 && word.startsWith(termStem))
    ) {
      out.push(word);
    }
  }
  return out;
}

/** The indexed words a query word could be a slip of. */
function typoMatches(index: Index, term: string): string[] {
  if (/\d/.test(term)) return [];
  const budget = typoBudget(term.length);
  if (budget === 0) return [];
  const termStem = stem(term);
  const stemBudget = typoBudget(termStem.length);
  const out: string[] = [];
  for (const [word, wordStem] of index.stems) {
    if (
      editDistance(term, word, budget) <= budget ||
      // Half-typed with a slip: "filharmno" for "filharmonia".
      (word.length > term.length &&
        editDistance(term, word.slice(0, term.length), budget) <= budget) ||
      (stemBudget > 0 && editDistance(termStem, wordStem, stemBudget) <= stemBudget)
    ) {
      out.push(word);
    }
  }
  return out;
}

/** The documents (by position) one query word lets through. */
function documentsFor(index: Index, term: string): Set<number> {
  let matched = closeMatches(index, term);
  for (const synonym of synonymsOf(term)) matched.push(...closeMatches(index, synonym));
  if (matched.length === 0) matched = typoMatches(index, term);
  const docs = new Set<number>();
  for (const word of matched)
    for (const position of index.postings.get(word) ?? []) docs.add(position);
  return docs;
}

const MIN_FRAGMENT = 4;

// The last index built, by the identity of the documents array: typing a
// second query over the same result set reuses it.
let cached: { docs: readonly unknown[]; index: Index } | null = null;

/**
 * The documents that match `query`, in their original order. `fieldsOf` gives
 * the texts to search in (name, venue, category...). A query that asks for
 * nothing returns every document.
 */
export function searchDocuments<T>(
  query: string,
  docs: readonly T[],
  fieldsOf: (doc: T) => readonly (string | null | undefined)[]
): T[] {
  const { phrase, terms } = parseQuery(query);
  if (terms.length === 0) return [...docs];

  const index =
    cached && cached.docs === docs
      ? cached.index
      : buildIndex(docs.map((doc) => fieldsOf(doc).map((f) => f ?? '')));
  cached = { docs, index };

  let hits: Set<number> | undefined;
  for (const term of terms) {
    const forTerm = documentsFor(index, term);
    const previous: Set<number> | undefined = hits;
    hits = previous ? new Set([...previous].filter((p) => forTerm.has(p))) : forTerm;
    if (hits.size === 0) break;
  }

  // The fragment match is for words cut mid-way ("ultikino"); below four
  // letters it finds noise — "dj" inside "zdjęcia".
  const fragment = phrase.length >= MIN_FRAGMENT ? phrase : null;
  return docs.filter(
    (_, position) =>
      (hits?.has(position) ?? false) ||
      (fragment !== null && index.texts[position].includes(fragment))
  );
}
