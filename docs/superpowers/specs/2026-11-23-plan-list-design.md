# "Twoje plany": several week plans, copies as new plans

2026-11-23 · follows [plan-share](2026-11-23-plan-share-design.md)

## Asked for

1. After "Skopiuj do mojego planu", land in the planner with the plan in it.
2. Several weeks planned, as a list.
3. Copying a shared plan creates a new plan instead of replacing mine.

## What was wrong with the copy

On the deployed site the copy wrote the plan to localStorage and then stayed on the shared view.
`router.replace('/szczecin/moj-tydzien')` from `/szczecin/moj-tydzien/?plan=…` does not navigate in
the static export.

- **Next 16.2 segment-cache bug.** A route-cache entry is keyed by pathname and keeps the canonical
  URL the document was cold-loaded with, query included. A navigation to the same pathname re-applies
  `?plan=…` and changes nothing.
- **The header has it too.** The nav link "Mój tydzień" did the same.
- **Already known.** `useFilterNavigation` hit this on the events list and works around it by
  writing history itself and replaying a `popstate`.
- **Why tests missed it.** `next dev` resolves the route fresh, so e2e (which runs on `next dev`)
  never saw it.

**Fix:** the workaround becomes `navigateInPage()` (`src/lib/inPageNavigation.ts`). It is used by the
filters, by the week plan, and by header links that point at the page already open with a query
string. The static-export e2e (`e2e-export/week-plan.spec.ts`) covers the copy and the list, because
only the export reproduces the bug.

## Model

The model is pure and lives in `src/lib/weekPlans.ts`.

- **A plan is a 7-day window.**
  - It is stored as `start` plus `settings` and `chosen`, exactly what one plan stored before.
  - It also carries:
    - `id`: 8 characters, base36;
    - `name`: custom, or `null` for a derived name;
    - `origin`: `own` or `copy`;
    - `sourceKey`: for copies, the shared event ids;
    - `createdAt`.
- **Own plans start on a Monday.**
  - The choice is this week plus the next 3.
  - Polish weeks are Monday–Sunday, so "Ten tydzień" and "Przyszły tydzień" mean what they say.
  - Days before today are not offered.
- **Data supports planning ahead.**
  - Events known on 23.11 per week ahead:
    - Szczecin: 1217 · 170 · 43 · 34;
    - Wrocław: 1493 · 280 · 73 · 72.
  - Further out it is mostly concerts and theatre, which is what people book ahead.
  - A plan beyond this week says that more events arrive closer to the date.
  - Proposals are redrawn on every open, so new events show up by themselves.
- **Copies start at their first event that is still ahead.**
  - A shared link can come from the old rolling window (Thursday to Wednesday). A Monday-aligned
    window would cut it in two.
  - A link holds at most 7 days of events, so the window always covers it.
- **The name is derived until the user renames the plan.**
  - Own plans: "Ten tydzień", "Przyszły tydzień", "Za 2 tygodnie"…, which stays true as days pass.
  - Copies: "Plan od znajomych".
  - The date range is always shown next to the name.
- **Expiry.** A plan whose window has ended is dropped on load, as past days always were.
- **Storage.**
  - Key: `go-to-city.week-plans.{city}`, value `{ version: 2, plans }`.
  - The single plan under the old `go-to-city.week-plan.{city}` key is migrated once into the list
    (start = its first day ahead), then the old key is removed.

## Screens (`/{city}/moj-tydzien/`)

| URL | Shows |
|---|---|
| `?plan=1.2.3` | Someone's plan, read-only. Unchanged, apart from the copy. |
| `?id=abc` | The planner for my plan `abc`. An id that is gone shows "this plan is no longer here" and a link to the list. |
| no query, no plans | The planner for a draft "Ten tydzień". It is saved, and the URL becomes `?id=`, on the first real change. A visitor who only looks does not leave an empty plan behind. |
| no query, some plans | The list: "Twoje plany". |

**The list.** Each plan is a card showing:
- the name and the range, with a "Skopiowany" badge for copies;
- the event count, or "Pusty plan";
- the first three event names.

Plus:
- **"Nowy plan"** opens the 4 weeks to choose from, each with its range.
- **Rename** and **Delete** sit in the card's menu. Delete offers "Cofnij" in a snackbar instead of
  asking first.

**The planner.**
- The heading is the plan's name and range, with "← Twoje plany" above it. The draft has no back
  link and keeps the old intro line.
- A menu offers Rename and Delete.
- Day chips are the plan's open days.
- Everything else stays as it was: moods, the board, "Zaskocz mnie", the calendar, sharing, the PDF.

**Copying a shared plan.**
- The button reads "Skopiuj do moich planów". The hint says it becomes a new plan and the visitor's
  own plans stay as they are.
- The replace-confirm dialog is gone, since nothing is replaced.
- Copying the same link again opens the copy already made instead of making a second one ("Ten plan
  już masz").
- After copying, the visitor lands in that plan's planner, with the old "Plan skopiowany" toast.
- "Ułóż własny tydzień" goes to the list, or to the draft for a visitor with no plans.
