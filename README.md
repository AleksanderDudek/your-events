# Your Events

Repository for presenting Your Events.

## Stack

A static, installable web app: Vite + React Router (framework mode, prerendered
at build time — no server at runtime), MUI, TanStack Query against Supabase,
and a `vite-plugin-pwa` service worker for offline use.

## Local development

Node 24 (`.nvmrc`), pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:3000 — no service worker in dev
pnpm build        # prerenders every page into out/
pnpm preview      # builds at the domain root and serves out/, service worker included
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # Playwright against the dev server
pnpm test:e2e:export   # Playwright against the static export
```

Configuration comes from `.env.local` (not committed), with `VITE_*` names —
the variables are listed in [src/vite-env.d.ts](src/vite-env.d.ts) and validated
in [src/config/env.ts](src/config/env.ts). Leave `VITE_BASE_PATH` empty to serve
at the domain root.

## Deployment

Two environments, dev and production, on separate GitHub Pages sites. Setup,
secrets and the release procedure: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

> Why do programmers prefer dark mode?
> Because light attracts bugs. 🐛
