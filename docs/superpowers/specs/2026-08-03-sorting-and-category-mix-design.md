# Sorting, and a mixed first page — design

Date: 2026-08-03
Status: designed while the owner was away; implemented under the assumptions
recorded here, to be reviewed on return.

## Problem

Two requests, one root cause.

**The first page misrepresents the site.** Unfiltered, the list is ordered by
date then start time, and the data is not evenly spread:

| Category | Events |
| --- | --- |
| Sport i Fitness | 283 |
| Film | 236 |
| Taniec | 87 |
| Wellness i Duchowość | 35 |
| Edukacja | 23 |
| Warsztaty | 19 |
| Muzyka | 15 |
| Dla Dzieci | 14 |
| Teatr i Widowiska | 14 |
| Imprezy i Rozrywka | 11 |
| Inne | 9 |
| Sztuka i Wystawy | 2 |

519 of 748 are gym classes and cinema screenings, and gym timetables cluster on
the hour. A visitor landing at 09:00 gets fifteen Zdrofit classes and concludes
the site is a gym timetable. The feedback is not about ordering being wrong —
date order is right — it is that *the first screen is the whole first
impression*.

**There is no way to reorder.** No control exists for sorting by anything.

## Approach

Both are answered by one concept: **the sort is a choice, and its default is a
mix**.

`sort` and `dir` join the other filters in the query string. `sort=mix` is the
default and is what a first visit gets.

### Why not simply reorder the whole result set client-side

The obvious implementation — fetch everything, interleave, paginate — was
measured and rejected: 748 rows is **1.5 MB raw, 405 KB gzipped, 0.66 s**. The
map view already pays that, but only when the user asks for a map. Paying it on
the default first paint of the most common page is the wrong trade.

### How the mix is built

One small query per category instead of one large one:

```
GET /events?category_main=eq.<category>&<active filters>&order=date,time_start&limit=3
```

Twelve of those in parallel is ~36 rows — roughly 75 KB raw, and one round trip
of latency rather than twelve. Two orders of magnitude cheaper than the full
fetch.

The categories come from the `categories` table, which `useCategories` already
loads and caches with `staleTime: Infinity`. When the user has selected
categories, the sampler runs over exactly those, so "mix" stays meaningful under
a filter: a spread of what matches, not a spread of everything.

The results are shuffled with a **per-session seed** kept in `sessionStorage`.
Reshuffling on every render would make the page jitter as React re-renders, and
reshuffling on every navigation would make going back show a different list —
both feel broken. One seed per session means the list is stable while you use
it and different next time you come back.

### Being honest about what the mix is

The mix is a sample, so its result count is the sample's size, not the
database's. Saying "Found 36 events" when there are 748 would read as a bug.

The list therefore reports both, reusing the pattern the map already
established for exactly this situation (`MAP_SHOWN_OF_TOTAL` — "showing N of M
that can be placed"). Under `sort=mix` the header reads *"a mix of 36 out of
748 events"*, and every other sort reports the true count as it does today.

The true total costs nothing extra: PostgREST returns it in `Content-Range` for
any query, and a `head: true` count request transfers no rows.

## The sort options

| Value | Order | Notes |
| --- | --- | --- |
| `mix` | The sampler above | Default. `dir` does not apply. |
| `date` | `date`, then `time_start` | What the list does today. |
| `name` | `name` | |
| `venue` | `venue` | |
| `price` | `price` | Nulls always last, in both directions — an unknown price is not "cheapest" and not "most expensive", and it must never head the list. |

`dir` is `asc` or `desc`, defaulting to `asc`. It is ignored for `mix`.

Sorting happens in Postgres, in `buildFilteredQuery`, so the list and the map
cannot disagree — the same reason every other filter lives there.

## URL contract

`?sort=name&dir=desc`. Both are omitted when they hold their defaults, so the
canonical unfiltered URL stays clean and today's saved presets and shared links
keep working unchanged — an absent `sort` reads as `mix`.

`sort` and `dir` are display preferences, not filters: like `viewMode` and
`pageSize` they survive "clear filters" and do not count towards the active
filter badge.

## Interaction with the rest

- **Paging** works normally in every mode. Under `mix` it pages the sample,
  which at 15 per page is two or three pages.
- **The map** ignores the sort entirely — a map has no reading order — but must
  respect `mix` if the user is in mix mode, or the map would show 748 pins for a
  36-event list. It samples the same way.
- **Presets** store the whole filter object, so `sort`/`dir` come along for free.
- **`sort=mix` with a text search** falls back to `date`: a search is already a
  precise question, and sampling three per category would hide most of the
  answers.

## Failure behaviour

- A category's query failing leaves that category out of the mix; the rest of
  the sample still renders. One dead category must not blank the page.
- An unknown `sort` or `dir` in the URL falls back to the default, the way every
  other parameter in `filterUtils` already does.
- The categories table failing to load means there is nothing to sample by, so
  the list falls back to `date` order.

## Testing

- `filterUtils.spec.ts` — `sort`/`dir` parse, round-trip and reject junk;
  defaults are omitted from the query string.
- `eventsApi.spec.ts` — each sort produces the expected PostgREST order clause;
  price orders nulls last in both directions.
- A new `categoryMix.spec.ts` for the pure part: given a per-category map of
  events and a seed, it takes at most 3 per category, includes every category
  that has any, and is stable for one seed and different across seeds.
- The existing suite must pass untouched: an absent `sort` behaves exactly as
  today for every caller that does not opt in.

## Assumptions made without the owner

1. **Three per category**, the top of the stated "1 to 3" range — with twelve
   categories that fills two and a half pages at the default page size.
2. **`mix` is the default**, not merely available. That is what the report asks
   for; a mix nobody selects would not change any first impression.
3. **The sample is taken from the soonest events**, not at random across the
   whole future. A random spread would surface things months away next to
   tonight, and "what is on" is the question this page answers.
4. **Venue sorting is by the raw venue string.** Polish collation is left to
   Postgres, which sorts diacritics correctly under the database's locale.
