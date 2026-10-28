# Seasonal sections — design

Date: 2026-10-28
Status: designed while the owner was away ("analyze, use best practices, pick
recommended, plan it out and finish on your own"); implemented under the
assumptions recorded here, to be reviewed on return.

## The request

> I want to add extra, season-dependent search sections to the frontend.
> Halloween is an example: it works for a short period. During that period I
> want to give people an extra tile and an extra quick filter.

The backend is done (both cities, both schemas):

- `events.seasons text[]` — `{halloween}` on Halloween events, `NULL` elsewhere.
- `seasons` table — `slug`, `name`, `emoji`, `description`, `date_from`,
  `date_to`, `show_from`, `active`, `sort`, `updated_at`. RLS on, one
  `public read` (SELECT) policy, same as `events`.
- Regular events are kept today + 7 days; seasonal ones up to 45 days ahead.

Measured on 2026-10-28: Szczecin 63 Halloween rows (52 titles), Wrocław 73
(62 titles), all dated 28–31 Oct; regular rows end on 4 Nov. Both
`public.seasons` and `dev.seasons` hold `halloween` (active, show 10 Oct →
2 Nov) and `swieta` (inactive, 15 Nov → 26 Dec, show from 10 Nov).

## Decisions

### 1. The season list is read at run time, per city

The site is a static export, so anything decided at build time would be stale
until the next deploy. The `seasons` table is read in the browser, from the
**city's own** project (not the categories project): the tags it describes live
in that city's `events`, and a season can then be switched on in one city only.

A season is offered when all of these hold:

- `active = true` (filtered in the query);
- `show_from ≤ today ≤ date_to` (in `lib/seasons`, local date, like every
  other date helper);
- it has at least one event from today on, within the default window — counted
  with a `head` request. Halloween's window runs to 2 Nov but its last event is
  on 31 Oct; on 1–2 Nov a tile promising "0 events" would be worse than none.

A failed or missing `seasons` read hides the feature instead of failing the
page: it is a bonus, never a dependency.

### 2. One URL parameter: `season=<slug>`

`EventFilters.season: string | null`, sent to PostgREST as
`seasons=cs.{halloween}` (`contains`). It composes with every other filter and
lives in the URL, so it is shareable, survives reloads and goes through the one
query builder the list and the map share. The slug is validated
(`[a-z0-9-]`, ≤ 40 chars) before it reaches a query.

It counts as an active filter (the "clear" button appears, the list can be
saved) and shows in the chip bar like a category, with its emoji and name.

### 3. Home: an extra tile, first and full-width

The owner asked for "an extra tile". During the season it heads the tile grid
spanning the whole row: emoji, the season's name and description, the number
of upcoming events and, before `date_from`, "Startuje 15 paź". Colours come from
a per-slug theme in the frontend (Halloween: night purple → pumpkin orange;
Święta: deep red → pine green), with a neutral fallback so a new season works
before anyone styles it.

It renders only after the season read lands (client-side, like the other
tiles' upgraded hrefs), so the static HTML is unchanged outside the season.

### 4. The list: a quick filter visible on every screen

Above the results, a "Sezonowe" bar with one toggle per offered season
("🎃 Halloween · 63"). It sits on the page, not in the filter drawer, so on a
phone it is one tap away — that is what makes it a *quick* filter. Pressed, it
shows the season's description underneath. Pressing it again removes it.

As with the phone search box, the drawer neither counts it nor clears it (its
"Wyczyść filtry" clears what the drawer shows); the desktop sidebar's clear
clears everything, the season included.

If the URL names a season that is not on offer (a link from last year, a saved
filter opened in November) the bar shows nothing for it, but the chip bar still
does, so the filter can be seen and removed.

### 5. Saved filters keep the season

"Halloween for the kids" is a reasonable thing to save, and since a slug is
reused year to year (`halloween` comes back next October) the preset comes back
to life with the season. `PresetFilters.season` is stored, validated like
everything read from localStorage, shown in the preset summary and removable in
the editor. Presets saved before this change read as `season: null`.

### 6. English

The season's name and description are Polish in the database; in English they
go through the same in-browser translator as event names (`<Translated/>`).

## After review

An independent review found nothing serious; these were fixed:

- **Slugs from the table were trusted.** One the URL parser rejects
  (`boze_narodzenie`, `Walentynki`) would get a tile that opens an unfiltered
  list and a toggle that can never show as pressed. Only slugs that pass
  `parseSeasonSlug` are offered now.
- **The tile's fade-in held `transform: none`** (fill mode `both`), so it was
  the one tile that did not lift on hover. It now uses `backwards`.
- **The description under a pressed toggle was not announced.** The toggle now
  points at it with `aria-describedby`.
- **Saved filters named a season from its slug** ("Swieta"). While the season
  is on offer they now use the table's name ("Święta"); the slug is the
  fallback once it is not.



- **Capping the main list at today + 7 days** (the backend note's suggestion).
  Rejected for now: the default window was set to today → +3 months yesterday
  at the owner's request, and an explicit date pick past day 7 would then hide
  seasonal events that do exist (e.g. a Christmas market on 12 Dec). With the
  default date ordering, seasonal rows past day 7 sit at the end of the list,
  after every regular event. Worth revisiting if the sparse tail confuses
  people — the place is `withDefaultDateWindow`.
- **A seasonal badge on event cards / detail pages.** Needs the season config in
  every card; a good follow-up once a second season is live.
- **Static landing pages** (`/wroclaw/halloween`) for SEO. Needs build-time
  season data and a rebuild per season; follow-up.
- **Clarity custom events** for the tile and the toggle — same follow-up as in
  the date-window spec.
