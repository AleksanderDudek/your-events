import { describe, it, expect } from 'vitest';
import {
  editDistance,
  fold,
  isSearchQuery,
  parseQuery,
  searchDocuments,
  stem,
  synonymsOf,
  typoBudget,
  words,
} from './search';

describe('fold', () => {
  it('drops case and every Polish diacritic, ł included', () => {
    expect(fold('Łódź, Wrocław, ŻÓŁĆ, gęślą jaźń')).toBe('lodz, wroclaw, zolc, gesla jazn');
  });
});

describe('words', () => {
  it('splits on anything that is not a letter or a digit', () => {
    expect(words('jazz / blues (live), 2026!')).toEqual(['jazz', 'blues', 'live', '2026']);
  });

  it('keeps a hyphenated word whole as well as in parts', () => {
    expect(words('stand-up')).toEqual(['stand', 'up', 'standup']);
  });
});

describe('stem', () => {
  it.each([
    ['koncertow', 'koncert'],
    ['koncerty', 'koncert'],
    ['koncertem', 'koncert'],
    ['jazzowy', 'jazz'],
    ['koncertowa', 'koncert'],
    ['teatrze', 'teatr'],
    ['ogrodzie', 'ogrod'],
    ['szczecinie', 'szczecin'],
    ['film', 'film'],
    ['2026', '2026'],
  ])('%s → %s', (word, expected) => {
    expect(stem(word)).toBe(expected);
  });

  it('brings the forms of one word together', () => {
    expect(stem('filharmonii')).toBe(stem('filharmonia'));
    expect(stem('kino')).toBe(stem('kinowy'));
    expect(stem('kina')).toBe(stem('kino'));
  });

  it('never cuts a word below three letters', () => {
    expect(stem('kot')).toBe('kot');
    expect(stem('ula')).toBe('ula');
  });
});

describe('editDistance', () => {
  it('counts a swap of neighbours as one slip', () => {
    expect(editDistance('koncret', 'koncert', 2)).toBe(1);
    expect(editDistance('teart', 'teatr', 2)).toBe(1);
  });

  it('gives up past the budget', () => {
    expect(editDistance('abcdef', 'uvwxyz', 1)).toBe(2);
    expect(editDistance('a', 'abcd', 1)).toBe(2);
  });

  it('allows no slip in a short word', () => {
    expect(typoBudget(3)).toBe(0);
    expect(typoBudget(4)).toBe(1);
    expect(typoBudget(8)).toBe(2);
  });
});

describe('parseQuery', () => {
  it('folds the query and drops stop words', () => {
    expect(parseQuery('Koncert  w Filharmonii')).toEqual({
      phrase: 'koncert w filharmonii',
      terms: ['koncert', 'filharmonii'],
    });
  });

  it('keeps stop words when there is nothing else', () => {
    expect(parseQuery('to').terms).toEqual(['to']);
  });

  it('knows an empty query from a real one', () => {
    expect(isSearchQuery('   ')).toBe(false);
    expect(isSearchQuery('!!!')).toBe(false);
    expect(isSearchQuery('jazz')).toBe(true);
  });
});

describe('synonymsOf', () => {
  it('maps English onto the Polish the events are written in', () => {
    expect(synonymsOf('concert')).toContain('koncert');
    expect(synonymsOf('kids')).toContain('dzieci');
  });

  it('also finds a group from an inflected form', () => {
    expect(synonymsOf('koncerty')).toContain('concert');
  });
});

// ── Searching ────────────────────────────────────────────────────────────────

interface Doc {
  id: number;
  name: string;
  venue: string;
  category: string;
  sub: string;
}

// Shaped after real rows (Szczecin and Wrocław, November 2026).
const DOCS: Doc[] = [
  {
    id: 1,
    name: 'Koncert jazzowy',
    venue: 'Filharmonia im. Mieczysława Karłowicza',
    category: 'Muzyka',
    sub: 'Jazz / Blues / Swing',
  },
  {
    id: 2,
    name: 'Kot Prot',
    venue: 'Multikino Galaxy Szczecin',
    category: 'Film',
    sub: 'Seans kinowy',
  },
  {
    id: 3,
    name: 'Degustacja wina',
    venue: 'Winiarnia',
    category: 'Imprezy i Rozrywka',
    sub: 'Wydarzenie miejskie',
  },
  {
    id: 4,
    name: 'Choinka z bajkami',
    venue: 'Teatr Lalek Pleciuga',
    category: 'Dla Dzieci',
    sub: 'Spektakl / Kino dla dzieci',
  },
  {
    id: 5,
    name: 'Jarmark Bożonarodzeniowy 2026 w Szczecinie',
    venue: 'Aleja Kwiatowa',
    category: 'Imprezy i Rozrywka',
    sub: 'Targi / Festyn',
  },
  {
    id: 6,
    name: 'Stand-up: Kowalski',
    venue: 'Klub Pod Kolumnami',
    category: 'Teatr i Widowiska',
    sub: 'Kabaret / Stand-up',
  },
  {
    id: 7,
    name: 'Joga',
    venue: 'Zdrofit Szczecin Galaxy',
    category: 'Wellness i Duchowość',
    sub: 'Yoga / Pilates',
  },
  {
    id: 8,
    name: 'Wystawa fotografii',
    venue: 'Muzeum Narodowe we Wrocławiu',
    category: 'Sztuka i Wystawy',
    sub: 'Wernisaż / Wystawa',
  },
  { id: 9, name: 'Jazda na rolkach', venue: 'Hala Sportowa', category: 'Sport i Fitness', sub: '' },
];

const fields = (d: Doc) => [d.name, d.venue, d.category, d.sub];
const ids = (query: string, docs: Doc[] = DOCS) =>
  searchDocuments(query, docs, fields).map((d) => d.id);

describe('searchDocuments', () => {
  it('ignores Polish letters, either way round', () => {
    expect(ids('wroclaw')).toEqual([8]);
    expect(ids('WROCŁAW')).toEqual([8]);
    expect(ids('bozonarodzeniowy')).toEqual([5]);
  });

  it('finds inflected forms', () => {
    expect(ids('filharmonii')).toEqual([1]);
    expect(ids('koncerty')).toEqual([1]);
    expect(ids('w teatrze')).toEqual([4, 6]);
    expect(ids('szczecinie')).toEqual([2, 5, 7]);
  });

  it('forgives a slip when the word is nowhere as typed', () => {
    expect(ids('koncret')).toEqual([1]);
    expect(ids('filharmonja')).toEqual([1]);
    expect(ids('muzuem')).toEqual([8]);
  });

  it('does not reach for typos when the word exists', () => {
    // "wina" is one letter from "kina"; "jazda" shares a stem's worth with "jazz".
    expect(ids('kino')).toEqual([2, 4]);
    expect(ids('jazz')).toEqual([1]);
  });

  it('matches words across name, venue and category — all of them (AND)', () => {
    expect(ids('jazz filharmonia')).toEqual([1]);
    expect(ids('koncert szczecin')).toEqual([]);
    expect(ids('jazz teatr')).toEqual([]);
  });

  it('finds what something is, not only what it is called', () => {
    expect(ids('stand-up')).toEqual([6]);
    expect(ids('standup')).toEqual([6]);
    expect(ids('stand up')).toEqual([6]);
    expect(ids('kabaret')).toEqual([6]);
    expect(ids('dla dzieci')).toEqual([4]);
  });

  it('understands synonyms and English', () => {
    expect(ids('yoga')).toEqual([7]);
    expect(ids('joga')).toEqual([7]);
    expect(ids('concert')).toEqual([1]);
    expect(ids('cinema')).toEqual([2, 4]);
    expect(ids('kids')).toEqual([4]);
    expect(ids('christmas')).toEqual([5]);
    expect(ids('museum')).toEqual([8]);
  });

  it('matches as you type', () => {
    expect(ids('filh')).toEqual([1]);
    expect(ids('kow')).toEqual([6]);
  });

  it('still finds a fragment inside a word, as the old ILIKE did', () => {
    expect(ids('ultiki')).toEqual([2]);
  });

  it('does not look for very short fragments inside words', () => {
    const docs = [
      { id: 1, name: 'Dj Złe Nawyki', venue: '', category: '', sub: '' },
      { id: 2, name: 'Zdjęcia kosmosu', venue: '', category: '', sub: '' },
    ];
    expect(ids('dj', docs)).toEqual([1]);
  });

  it('matches numbers exactly or as a prefix, never by typo', () => {
    expect(ids('2026')).toEqual([5]);
    expect(ids('2027')).toEqual([]);
  });

  it('finds nothing for gibberish', () => {
    expect(ids('zzxqwv-nonexistent-000111')).toEqual([]);
  });

  it('returns everything, in order, for an empty query', () => {
    expect(ids('  ')).toEqual(DOCS.map((d) => d.id));
  });

  it('keeps the order it was given', () => {
    const reversed = [...DOCS].reverse();
    expect(ids('szczecin', reversed)).toEqual([7, 5, 2]);
  });

  it('copes with empty and missing fields', () => {
    expect(
      searchDocuments('jazz', [{ a: null }, { a: 'Jazz' }, { a: undefined }], (d) => [d.a]).length
    ).toBe(1);
  });
});
