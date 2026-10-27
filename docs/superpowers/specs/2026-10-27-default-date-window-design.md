# Default date window — design

Date: 2026-10-27
Status: designed while the owner was away ("analyze, use best practices, pick
recommended, plan it out and finish on your own"); implemented under the
assumptions recorded here, to be reviewed on return.

## The request

> I want to have a behavior that if no date filter is selected it takes by
> default today's date up till + 3 months. The reason for that is when I create
> my own filter and save it, and then go back after some time, I have no way of
> either having just TODAY's events with filter OR events from today and in the
> future. This needs to work perfectly.

## How it works today

- With no date filter, `buildFilteredQuery` sends no date clause at all. The
  tables keep events after they happen: measured on 2026-10-27, Szczecin held
  178 rows dated before today and Wrocław 122 (Wrocław's oldest was five days
  old). The list's default order is date ascending, so an unfiltered list — and
  every saved filter without a date — **opens on yesterday's events**.
- Saving from the list (`SavePresetButton` → `presetFiltersFromEventFilters`)
  turns whatever dates are on screen into a `fixed` window. Picking "today" and
  saving freezes that day: a week later the preset opens on a past date. The
  relative windows (`today`, `weekend`, `next7`) exist, but only in the editor
  on `/moje-filtry`, which the user has to know about and go to.
- Choosing "today" on the list takes three steps: open Date, pick "Jeden
  dzień", pick today in a calendar.

## Decisions

### 1. No date means "today to three months ahead" — resolved at query time

**Chosen:** when the URL carries no date value (no `dateSingle`, `dateFrom` or
`dateTo`), the events query gets `dateFrom = today`, `dateTo = today + 3
months`. This happens in `useResolvedFilters` (the one place both the list and
the map build their query from), via `withDefaultDateWindow` in the new
`src/lib/dateWindows.ts`.

The URL is **not** rewritten:

- A saved filter or shared link with no date keeps meaning "from whenever it
  is opened", which is exactly the "events from today and in the future" the
  request asks for. Writing today's dates into the URL would freeze them.
- `countActiveFilters` and the chips stay honest: the default is not a filter
  the user set, so there is nothing to remove, and the "clear filters" button
  does not appear for it.

The default is keyed on date *values*, not on `dateMode`: choosing "Zakres
dat" before picking any dates used to drop the date clause too and show past
events; it now shows the default window until a date is picked.

Explicit dates are always respected, including past ones — someone who picks
last Saturday wants last Saturday. A half-open range (only "from" or only "to")
is explicit too and is left as it is.

"Three months" uses date-fns `addMonths`, which clamps to the end of a shorter
month (30 Nov → 28 Feb). Dates are local, matching every other date helper in
the app.

Today the tables hold roughly a week ahead, so the upper bound changes nothing
yet; it is there because it was asked for, and it bounds the query if the
pipeline starts publishing further out.

The query key carries the resolved dates, so the cache cannot serve
yesterday's "today" after midnight once the list re-renders.

### 2. Say what the default is

The Date section of the filter panel shows, while no date is chosen: "Bez
wybranej daty: od dziś przez najbliższe 3 miesiące" / "No date picked: from
today for the next 3 months". No concrete date in the text, so there is no
build-time/run-time mismatch to worry about.

### 3. Quick picks on the list: Dziś · Ten weekend · 7 dni

Three toggle chips above the "Jeden dzień / Zakres dat" switch. They write the
same URL parameters the pickers do (today as `dateMode=single`, the others as
a range), and a chip shows as pressed whenever the dates on screen match its
window — whichever way they were picked. Pressing a pressed chip clears the
date. These are exactly the relative windows a preset can hold, so what the
user picks here is what can be saved as relative (decision 4).

Rejected: a "Jutro" chip. There is no `tomorrow` preset window, so it would
save as a fixed date and reintroduce the rot this work removes; it can be added
together with a window if asked for.

### 4. Saving asks how the dates should behave

The save dialog gains a "Kiedy" select, like the editor's, preselected by
`inferDateWindow(filters, now)`:

| On screen | Preselected |
|---|---|
| no date | "Od dziś (najbliższe 3 miesiące)" — `none` |
| today (single or a one-day range) | "Dzisiaj" — `today` |
| the upcoming Fri–Sun | "Najbliższy weekend" — `weekend` |
| today → today + 7 | "Najbliższe 7 dni" — `next7` |
| any other dates | "Dokładnie te daty: 2026-11-05 – 2026-11-08" — `fixed` |

The user can override it in either direction — keep exact dates that happen to
match a window, or turn a fixed range into a relative one. The `fixed` option is
offered only when there are dates to fix.

`none` is relabelled everywhere from "Bez ograniczeń / Any time" to "Od dziś
(najbliższe 3 miesiące) / From today (next 3 months)", because that is now what
it does.

## After review

An independent review of the first cut found three things, all fixed:

- **On a Sunday, "Ten weekend" saved as "Dzisiaj".** That day the coming
  weekend *is* today, so the dates alone cannot tell the two apart. Today is
  now always written as a single day — by the "Dziś" pick and by a `today`
  preset opening (`presetToEventFilters`) — and the weekend as a range, so a
  single day reads back as today and a one-day range as the weekend.
- **A half-open fixed range collapsed to one day.** `resolveDateWindow`
  mirrored the missing end onto the present one, so a preset "from 6 Nov on"
  opened on 6 Nov only — contradicting its own comment. It now stays
  half-open, and the save dialog and the preset tiles name it "od 6 Nov" /
  "do 6 Nov" (`describeFixedRange`) rather than as a single day.
- **Hours vanished when saving as "from today".** Hours still need a date (see
  below), so the dialog now says so in place of its hint when that choice would
  drop them, instead of dropping them silently.

Noted and kept: "Najbliższe 7 dni" runs today → today + 7, eight calendar
days, as the preset window always has.

## What does not change

- Hour ranges still need an explicit date (the existing rule, kept in the
  parser, the panel and the preset editor). Letting hours stand alone now that
  a default window always exists ("evenings, any day") is a reasonable next
  step but changes several established rules; left for the owner to decide.
- The weekday filter already expanded from today forward when no range was
  given; it now expands over the default window, which ends earlier than its
  180-day horizon.
- Home tiles, deep links and presets with explicit dates behave exactly as
  before.

## Microsoft Clarity — consent by default (answered, not built)

The owner asked whether Clarity could run as "accepted" until a visitor opts
out. It cannot, and nothing was changed:

- The site is Polish and EU-facing. Storing or reading non-essential cookies
  (Clarity's `_clck` / `_clsk` are analytics, not essential) needs prior opt-in
  consent under the ePrivacy rules (in Poland, art. 399 of Prawo komunikacji
  elektronicznej). A pre-ticked or assumed "yes" is not consent (CJEU, Planet49,
  C-673/17). Having no accounts or sensitive data does not change this — the
  rule is about touching the device, and session replays with IP and device
  data are personal data anyway.
- Clarity itself has enforced a consent signal for EEA/UK/CH visitors since 31
  October 2025; sending `granted` without a real choice would be a false signal
  under its terms.

What the owner already has: Clarity records **every** visitor before any choice
and after a rejection, just without cookies — recordings, heatmaps, clicks,
scrolls, pages. Because the app is a single-page app, one cookieless recording
covers a whole visit's in-app navigation; only a reload or a later return
starts a new, unlinked session. The consent only buys linking visits together.

A legitimate way to learn more about how the app is used is Clarity custom
events / tags (`clarity('event', …)`, `clarity('set', …)`) on key actions —
filter applied, preset saved or opened, view switched. They ride on the same
cookieless recording. Not built here; offered as a follow-up.
