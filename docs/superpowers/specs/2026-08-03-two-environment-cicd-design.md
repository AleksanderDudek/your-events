# Two environments (dev + prod) on GitHub Pages — design

Date: 2026-08-03
Status: approved, not yet implemented

## Problem

The site is a Next.js static export deployed to GitHub Pages from a single
repository. Every push to `main` goes straight to the only URL there is,
`https://aleksanderdudek.github.io/your-events`. There is nowhere to look at a
change before the public sees it, and nowhere to try a risky one at all.

We want two environments: a development site that follows `main`, and a
production site that only moves when we decide it moves.

## The constraint that shapes everything

**GitHub Pages serves one site per repository.** Two URLs therefore require two
repositories. Nothing in the GitHub ecosystem works around this; the only
question is what lives in the second repository.

A second constraint follows from the app being a static export: event detail
pages are baked at build time (`generateStaticParams` with
`dynamicParams=false`), so the site must rebuild to show events the scraper
added after the last build. That is why `deploy.yml` already runs on a 3-hourly
cron and on a `repository_dispatch` from the backend. **Production must be able
to rebuild itself from data without a code release** — publishing a built
artifact once is not enough.

## Decisions

| Question | Decision |
| --- | --- |
| Which repo is production | New `your-events-prod`. The existing repo becomes dev. |
| What lives in the prod repo | Static output only. No sources, no workflows, no secrets. |
| Dev data source | Separate Supabase, arranged by the owner: either projects on a second account, or copied tables inside one project. |
| Release trigger | Manual. Moving the `production` branch is the release. |
| Prod approval | GitHub Environment protection rule — a release waits for a reviewer. |

The URL change is accepted: production moves to
`https://aleksanderdudek.github.io/your-events-prod` and the old address becomes
the dev site. Search Console cleanup is deferred to the custom-domain migration.

## Architecture

`your-events` stays the only place with sources, workflows and secrets.
`your-events-prod` is a dumb static host.

```text
your-events  (source of truth)
├── branch main        ──build with env "dev" ──▶ this repo's Pages   = DEV
└── branch production  ──build with env "prod"──▶ push out/ ──┐
                                                              │
your-events-prod  (hosting only)                              ▼
└── branch gh-pages ── static files ── Pages ── .../your-events-prod = PROD
```

Rejected alternatives:

- **Mirror the sources into the prod repo** and let it build itself. Production
  becomes independent of the source repo, at the cost of duplicated workflows,
  duplicated secrets and two configurations free to drift apart. Not worth it
  for a one-person project.
- **One repo, two paths** (`/your-events/` and `/your-events/dev/`) inside a
  single Pages artifact. Every deploy would replace both at once, so there is no
  independent release — which is the entire point of the exercise.

## Branch model and release flow

`production` is a branch in `your-events` that points at the released commit.

- **Release**: fast-forward `production` to a chosen commit of `main`.
- **What is pending**: `git log production..main`.
- **Rollback**: move `production` back to the previous commit. The next build
  serves the old code with today's data.

`production` never receives its own commits. It is a pointer, not a line of
development.

## Workflows

Four workflows in `your-events`. `ci.yml` and `e2e.yml` keep their current
triggers and are untouched apart from reading dev credentials.

### `deploy-dev.yml`

Replaces today's `deploy.yml`.

- Triggers: push to `main`, 3-hourly cron, `repository_dispatch: events-updated`,
  manual.
- Environment: `dev`.
- Publishes with `upload-pages-artifact` + `deploy-pages`, exactly as today.
- Concurrency group `pages-dev`.

### `deploy-prod.yml`

- Triggers: 3-hourly cron, `repository_dispatch: events-updated`, manual.
  Deliberately **not** `push: production`: a push made with `GITHUB_TOKEN` does
  not start a workflow, so a release-driven push would silently deploy nothing.
  `release.yml` therefore dispatches this workflow explicitly —
  `workflow_dispatch` is one of the two events exempt from that rule.
- Environment: `prod` — so every run, including cron, is subject to the
  environment's protection rule.
- Checks out `production` explicitly (`ref: production`), not the triggering
  ref, so a cron run on any branch still builds what is released.
- Builds, writes `out/.nojekyll`, force-pushes `out/` as a single orphan commit
  to `gh-pages` in `your-events-prod` over SSH.
- Concurrency group `pages-prod`.

### `release.yml`

- Trigger: manual only, with a `ref` input defaulting to `main`.
- Fast-forwards `production` to that ref and pushes it, then dispatches
  `deploy-prod.yml`. Creates the branch if it does not exist yet, which is what
  the first release does.
- Refuses a non-fast-forward move unless a `force` input is set, so a release
  cannot silently discard commits.

### Notifications

Both deploy workflows keep the existing Discord step, with the environment name
in the message so `🌐 dev` and `🌐 prod` are distinguishable in one channel.

## Environments, secrets and variables

Everything lives in `your-events`. The prod repo holds no secrets at all.

**Environment `dev`** — secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL_WROCLAW`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW`

**Environment `prod`** — the same four names with production values, plus:

- `PROD_DEPLOY_KEY` — private SSH key with write access to `your-events-prod`.

Protection rule on `prod`: required reviewer (the repo owner). Nothing reaches
production without a click.

**Variables** (`vars`, not secrets — they ship in the bundle and belong in plain
sight), set per environment:

| Variable | dev | prod |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_ORIGIN` | `https://aleksanderdudek.github.io` | `https://aleksanderdudek.github.io` |
| `NEXT_PUBLIC_BASE_PATH` | `/your-events` | `/your-events-prod` |
| `NEXT_PUBLIC_ENABLED_CITIES` | `wroclaw,szczecin` | `wroclaw,szczecin` |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | *(empty)* | `xtfje919ui` |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | `public` | `public` |
| `NEXT_PUBLIC_ROBOTS_NOINDEX` | `true` | *(empty)* |

Clarity is deliberately empty on dev: pointing test traffic at the production
project would corrupt the very statistics the tag exists to collect. This
mirrors the reasoning already recorded in `env.ts` for why the tag is absent
from local and CI runs.

The anon key is baked into the client bundle and is public by nature. It is kept
in secrets for tidiness and rotation, not for confidentiality — access control
is Supabase RLS, not this value.

## Code changes

Four, all small.

### 1. `.nojekyll`

Pages served from a branch runs the tree through Jekyll, which strips
directories whose names begin with an underscore. Without `.nojekyll` the
`_next/` directory disappears and production is a blank page. The current
`upload-pages-artifact` path adds this implicitly; a branch deploy does not.
`deploy-prod.yml` writes the file after the build.

### 2. `NEXT_PUBLIC_SUPABASE_SCHEMA`

`getSupabaseForCity` passes `{ db: { schema } }` to `createClient`, defaulting to
`public`. This is what makes "copied tables inside one project" viable without
touching a single query: `eventsApi` keeps calling `.from('events')`.

If dev instead gets its own Supabase projects, the variable stays `public` and
costs nothing. The schema must be added to the project's exposed schemas in
Supabase's API settings for PostgREST to serve it.

### 3. Dev is not indexable

Two mechanisms, because they do different jobs:

- `robots.ts` returns `disallow: /` for every agent when
  `NEXT_PUBLIC_ROBOTS_NOINDEX` is set. Stops crawling.
- `layout.tsx` metadata gains `robots: { index: false, follow: false }` under the
  same flag. Stops indexing, which `robots.txt` alone does not — a disallowed
  page can still be indexed from inbound links, just without its content.

`env.ts` gains the two new variables with defaults that preserve today's
behaviour (`public`, and indexable).

### 4. The base path is hardcoded in two files

`layout.tsx` writes `/your-events/favicons/...` into five `<link>` tags and
`manifest.ts` repeats it in `start_url` and three icon entries. Next.js
auto-prefixes `<Link>` and imported assets, but not raw hrefs written by hand.
Under production's `/your-events-prod` base path every one of them would 404 —
no favicon, a broken web manifest, no installable PWA.

Both files switch to the existing `withBasePath()` helper from
`@/lib/constants`, which already resolves the same env var. This is a
pre-existing latent bug: it is invisible today only because exactly one base
path has ever been deployed.

## Deploy key

An SSH deploy key rather than a personal access token: it is scoped to exactly
one repository, grants exactly write access, and does not expire or carry the
owner's whole account with it.

Generated locally, never committed:

```bash
ssh-keygen -t ed25519 -C "your-events-prod deploy" -N "" -f prod_deploy_key
```

- `prod_deploy_key.pub` → `your-events-prod` → Settings → Deploy keys, with
  **Allow write access** ticked.
- `prod_deploy_key` (private) → `your-events` → Environments → `prod` →
  `PROD_DEPLOY_KEY`.
- Both local files deleted afterwards.

## Rebuild cadence

Both environments keep the 3-hourly cron and both listen for the backend's
`events-updated` dispatch, so a scrape refreshes dev and production alike. The
backend needs no change: it already dispatches to `your-events`, which is where
both workflows now live.

## Testing

- `ci.yml` (lint, type-check, unit) is unchanged and gates PRs as before.
- `e2e.yml` runs against dev credentials. It stays non-blocking.
- After the first prod deploy, verification is manual and specific:
  `_next/` assets return 200 (proves `.nojekyll` works), an event detail page
  renders, `robots.txt` on dev disallows everything, and dev's HTML carries
  `noindex` while prod's does not.

## Accepted trade-offs

- `your-events-prod` must be **public**; Pages from a private repo needs a paid
  GitHub plan.
- The old URL becomes dev and will serve `noindex` for a while to a search index
  that still points at it.
- Production history in the prod repo is a single force-pushed commit. Rollback
  is moving `production` in the source repo and rebuilding, so prod-repo history
  is not a recovery mechanism and does not need to be preserved.
- A cron run of `deploy-prod.yml` also waits for environment approval. This is
  intentional — data-only rebuilds are still production deploys — but it means
  production goes stale if approvals are ignored. If that becomes annoying, the
  reviewer rule can be narrowed to the `production` branch push only.

## Out of scope

Custom domain and CNAME. Supabase Pro, branching, or any dev-database
provisioning — the owner arranges dev data independently, and the design only
has to make the credentials swappable.
