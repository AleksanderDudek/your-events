# Search that forgives: Polish letters, inflection, typos

## Problem

The search box ran `name ILIKE '%term%' OR venue ILIKE '%term%'` in PostgREST.
That misses most of what people type:

| Typed | Means | ILIKE found |
| --- | --- | --- |
| `wroclaw`, `swieta` | Wrocław, święta | nothing — no Polish letters |
| `koncerty w filharmonii` | concerts at the Philharmonic | nothing — inflected, two words |
| `koncret`, `filharmonja` | typos | nothing |
| `stand-up`, `kino`, `dla dzieci` | a kind of event | only titles that say so; the category was not searched |
| `jazz filharmonia` | words in different fields | nothing |
| `concert`, `kids` (English site) | — | nothing; events are written in Polish |

## Decision

Match in the browser, over a light scan of the events the other filters let
through: `id, lat, lng, price columns, name, venue, category_main,
category_sub` — about 250 bytes a row (descriptions, which make a row 2.4 KB,
are not searched). A city has 1.5–2k upcoming events, so a scan is a few
hundred KB raw, cached for a minute and reused while the visitor types, turns
pages or opens the map.

Considered and not done:

- **Postgres `unaccent` + `pg_trgm` behind an RPC.** Better at 100k rows, but
  needs migrations in every city's Supabase project and both schemas, owned by
  the scraper pipeline, and Postgres has no Polish stemmer on Supabase.
- **A library (MiniSearch, Fuse.js).** Fuzzy matching is the easy part; the
  Polish part (ł, inflection, stop words, typo budget by word length) would
  have to be written anyway, and a filter that keeps the list's own order
  needs no ranking engine.

## Matching rules (`src/lib/search.ts`)

1. Fold case and diacritics on both sides (`ł → l` explicitly — NFD leaves it).
2. Split into words; hyphenated words also index joined (`stand-up` → `standup`).
   Drop stop words (`w, na, dla, i, the, of…`).
3. Every query word must match a word of the event (AND across name, venue,
   category, subcategory), by any of:
   - exact, or prefix (as you type);
   - same stem — a light Polish stemmer strips one ending (`koncertów`,
     `koncerty` → `koncert`; `jazzowy` → `jazz`; `w teatrze` → `teatr`);
   - a synonym, including English (`kino ↔ film ↔ seans ↔ cinema`,
     `concert → koncert`, `joga ↔ yoga`).
4. Only when none of that matches anything in the whole result set: a typo
   (1 edit from 4 letters, 2 from 8; adjacent swaps count as one). Typos are a
   fallback so `kino` never drags in `wino`.
5. The whole query as typed (folded, ≥ 4 letters) as a substring also matches,
   so a fragment like `ultikino` still finds Multikino, as ILIKE did.

The list keeps its chosen sort (date by default); search only filters.

Checked against live rows from Szczecin and Wrocław (2,000 events): `kino`
722, `koncert` 150, `koncret` 144, `filharmonii` 20, `stand-up` 21; ~18 ms to
build the index, ~1 ms per query after.

## Integration (`src/components/service/eventsApi.ts`)

- A search is a client filter, like free entry and the radius: the list scans
  ids, then reads whole rows for the page only.
- The map reads whole rows only for the matches with coordinates (≤ 1000), in
  chunks of 200 ids.
- Scans are cached for 60 s per city and database-side filters. The churn
  retry (rows rewritten between scan and page) bypasses the cache.

## Not changed

The 1.5 s debounce: each pause writes a history entry, so a shorter one turns
Back into a replay of half-typed words.
