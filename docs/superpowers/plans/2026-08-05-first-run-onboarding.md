# First-run onboarding implementation plan

**Goal:** A first-time visitor gets a short welcome sheet and, if they ask for
it, a five-step spotlight tour of the controls that make the site useful.

**Architecture:** Pure state in `src/lib/onboarding.ts` + `src/lib/tourSteps.ts`,
a `useSyncExternalStore` binding in `src/components/service/useOnboarding.ts`,
and an `Onboarding` orchestrator mounted once in `AppLayout`. Mirrors the
`lib/consent.ts` + `service/useConsent.ts` split.

**Tech stack:** Next.js 16 (`output: 'export'`), React 19, MUI 7, SCSS modules,
Vitest + Testing Library, Playwright, Zod-validated env.

**Spec:** `docs/superpowers/specs/2026-08-05-first-run-onboarding-design.md`

---

## Conventions this must follow

- localStorage keys are namespaced `go-to-city.*`.
- Client components start with `'use client'`.
- Polish is the source of truth in `messages.ts`; English is checked with
  `satisfies Messages`, so a missing English key is a type error.
- Components live in `src/components/common/<Name>/<Name>.tsx` with a sibling
  `.module.scss` and `.spec.tsx`.
- `trailingSlash: true` — routes end in `/`.
- Package manager is **pnpm**. Never run `npm install`.
- Env vars go through the Zod schema in `src/config/env.ts`; the derived boolean
  lives in `src/config/site.ts`.

## Tasks

- [ ] **1. Env flag.** `NEXT_PUBLIC_ONBOARDING_ENABLED` in the schema
      (default `'true'`), `IS_ONBOARDING_ENABLED = value !== 'false'` in
      `site.ts`. Only the exact string `'false'` disables it, so a typo leaves
      the feature on rather than silently removing it.
- [ ] **2. `src/lib/onboarding.ts` + spec.** Storage key, `ONBOARDING_VERSION = 1`,
      `parseSeenVersion`, `hasSeenCurrent`, `isOnboardingRoute`, `isTourRoute`.
      Route predicates work on the pathname with the base path already stripped
      by `usePathname`, and must tolerate a trailing slash.
- [ ] **3. `src/lib/tourSteps.ts` + spec.** `TourStepId` union, `TOUR_STEPS`
      with `{ id, selector, placement }`, and `visibleSteps(doc)` returning the
      steps whose anchors exist.
- [ ] **4. `useOnboarding` + spec.** External store over localStorage, the two
      transient flags, and the gates (flag, hydration, consent, route).
- [ ] **5. Copy.** `ONBOARDING_*` keys in both locales, including a
      `Record<TourStepId, { title, body }>`.
- [ ] **6. `WelcomeSheet` + spec.** MUI Dialog, three bullets, Pomiń / Pokaż mi.
- [ ] **7. `TourOverlay` + spec.** Spotlight hole, MUI Popper tooltip, keyboard
      handling, live region, scroll lock, resize recompute.
- [ ] **8. `Onboarding` orchestrator + mount in `AppLayout`.**
- [ ] **9. `data-tour` attributes** on the search box, filter panel + Fab, view
      toggle, sort control and the "Moje filtry" nav link.
- [ ] **10. Footer replay link** ("Jak to działa?"), hidden when the flag is off.
- [ ] **11. e2e** `e2e/onboarding.spec.ts` including an axe pass.
- [ ] **12. Verify.** `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`,
      and a browser pass on the built export.
