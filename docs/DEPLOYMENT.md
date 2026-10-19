# Deployment

Two environments, on two GitHub Pages sites. GitHub Pages serves one site per
repository, which is the whole reason a second repository exists.

| | Dev | Production |
| --- | --- | --- |
| Follows | `main`, every push | `production`, moved by hand |
| Built by | `deploy-dev.yml` | `deploy-prod.yml` |
| Repository serving it | `your-events` (this one) | `your-events-prod` |
| URL | [/your-events](https://aleksanderdudek.github.io/your-events) | [idznamiasto.pl](https://idznamiasto.pl) |
| Data | `dev` schema | `public` schema |
| Indexable | No — `noindex` + `robots.txt` disallow | Yes |
| Clarity | Off | On |

All source, all workflows and all secrets live in **this** repository.
`your-events-prod` holds static files and nothing else: no sources, no
workflows, no secrets. Do not commit to it by hand — every deploy force-pushes
over its `gh-pages` branch.

**Dev and production share the Supabase projects and differ only by Postgres
schema**: production reads `public`, dev reads `dev`, and the `dev` schema is a
mirror of `public` maintained by the scrape pipeline. One project, two sets of
tables, one anon key. Nothing but the schema variable distinguishes them, so a
change of environment is a change of one variable and never a change of
credentials.

The schema reaches PostgREST as its `Accept-Profile` header, set from
`VITE_SUPABASE_SCHEMA` in [src/lib/supabase.ts](../src/lib/supabase.ts).
It defaults to `public` when the variable is absent
([src/config/env.ts](../src/config/env.ts)) — a forgetful failure therefore
lands on production data, which is the safe direction for production and the
wrong one for dev. Dev must set the variable explicitly; that is why it is not
left to the default.

The reasoning behind the split is in
[docs/superpowers/specs/2026-08-03-two-environment-cicd-design.md](superpowers/specs/2026-08-03-two-environment-cicd-design.md).

## The build

`pnpm build` is `react-router build` (Vite + React Router framework mode,
`ssr: false`). It prerenders every page to HTML — the event permalinks and
category hubs from the database, through build-time `loader`s — and
[build-tools/finalizeExport.ts](../build-tools/finalizeExport.ts) shapes the
result into `out/`, the directory both deploy workflows publish:

| In `out/` | What it is |
| --- | --- |
| `<path>/index.html` | a prerendered page |
| `<path>/_.data` | the same page's loader data, fetched on client-side navigation |
| `404.html` | the SPA fallback: boots the router at any path the build did not write |
| `sitemap.xml`, `robots.txt` | generated from the same data as the pages |
| `manifest.webmanifest`, `sw.js`, `offline.html` | the PWA (below) |
| `assets/` | hashed JS/CSS |

`finalizeExport` fails the build when `out/` lacks any file a deploy needs —
the home page, `404.html`, `sw.js`, the manifest, `offline.html`,
`sitemap.xml`, `robots.txt` — so a broken build stops the deploy and the
previous one stays up.

Every pull request builds the site exactly as `deploy-dev.yml` does (`CI` →
*Static export build*, in the `dev` environment). It is a required status check
on `main`: a change that breaks the prerender, the service worker or the output
cannot be merged. Renaming that job means updating the branch protection too.

### Variable names

The app reads `VITE_*` — Vite inlines only that prefix into the bundles. The
GitHub secrets and variables kept their historical `NEXT_PUBLIC_*` names, and
each workflow maps one onto the other (`VITE_SUPABASE_URL: ${{
secrets.NEXT_PUBLIC_SUPABASE_URL }}`), so the move off Next.js needed no change
in the repository settings. The tables below list the GitHub names. For local
development, `.env.local` uses the `VITE_*` names directly.

Renaming the GitHub side to `VITE_*` is optional tidying: create the new names,
point the workflows at them, then delete the old ones.

### The service worker

`vite-plugin-pwa` ([build-tools/pwa.ts](../build-tools/pwa.ts)) writes the web
manifest and builds [src/sw.ts](../src/sw.ts) with Workbox. Only the app shell
is precached (JS, CSS, icons, `offline.html` — about 1.8 MB); pages, their
`.data`, Supabase reads and images are cached as they are used:

| Request | Strategy | Kept |
| --- | --- | --- |
| Pages | network first, 3 s timeout, then cache, then `offline.html` | 50, 7 days |
| `*.data` | network first, 3 s timeout | 100, 7 days |
| Supabase `GET /rest/v1/` | network first, 5 s timeout | 100, 1 day |
| Own images | cache first | 200, 30 days |
| Event art (third-party) | stale-while-revalidate | 60, 7 days |
| Google Fonts | stylesheet stale-while-revalidate, files cache first | 1 year |

Pages and `.data` are dropped whenever a new version of the code activates:
they name the previous version's bundles, which go with it.

A new deploy is noticed on the next page load, or within the hour by a tab
left open. The worker installs in the background and waits; the page shows a
"new version" prompt and switches only when asked — it never reloads under
someone mid-filter. A data-only rebuild (the 3-hourly cron, the scraper's
dispatch) changes no precached file, so `sw.js` stays the same and nobody is
prompted.

There is no service worker in `pnpm dev`. To try it locally:
`pnpm preview` (builds at the domain root and serves `out/`).

If a broken worker ever ships, set `selfDestroying: true` in
`build-tools/pwa.ts` and deploy: the next visit replaces it with one that
unregisters itself and clears its caches.

## Moving off Next.js: the one-time transition

`deploy-prod.yml` runs from `main` but builds the `production` branch. Until
`production` is released past the Vite migration, that branch is still the
Next.js app — so the workflow passes every variable under both names (Vite
reads `VITE_*`, Next reads `NEXT_PUBLIC_*`, each ignores the other), pins Node
24 (which both need), and keeps the `.nojekyll` step Next's `_next/` depends on.

Once the first Vite release is live, delete the `NEXT_PUBLIC_*` block from the
build step of `deploy-prod.yml`; the `.nojekyll` step can go too
(`finalizeExport` writes the marker itself).

## One-time setup

**This has been done.** What follows is the record of how, kept because it is
also the recipe for rebuilding the production side from nothing — after losing
the deploy key, say, or when standing up a third environment.

### 1. The production repository

```bash
gh repo create AleksanderDudek/your-events-prod --public \
  --description "Production build of your-events. Generated — do not edit; sources live in AleksanderDudek/your-events."
```

It must be **public**: Pages from a private repository needs a paid GitHub plan.

### 2. Seed and enable its Pages

Pages cannot be pointed at a branch that does not exist yet.

```bash
tmp=$(mktemp -d) && cd "$tmp"
git init -q -b gh-pages
printf 'Production build of your-events. Generated by deploy-prod.yml — do not edit.\n' > README.md
touch .nojekyll
git add -A && git commit -q -m "Initialise the hosting branch"
git push -q https://github.com/AleksanderDudek/your-events-prod.git gh-pages
cd - && rm -rf "$tmp"

gh api -X POST repos/AleksanderDudek/your-events-prod/pages \
  -f 'source[branch]=gh-pages' -f 'source[path]=/'
```

### 3. The deploy key

An SSH deploy key rather than a personal access token: it is scoped to exactly
one repository, grants exactly write access, and does not carry the whole
account if it leaks.

Neither half is ever printed: the public half goes to the hosting repository and
the private half to the `prod` environment, both straight from the file.

```bash
umask 077
ssh-keygen -t ed25519 -C "your-events-prod deploy" -N "" -f prod_deploy_key

# Public half → the repository it may write to.
gh repo deploy-key add prod_deploy_key.pub \
  --repo AleksanderDudek/your-events-prod \
  --title "your-events deploy (Actions)" --allow-write

# Private half → the environment that may read it.
gh secret set PROD_DEPLOY_KEY --env prod \
  --repo AleksanderDudek/your-events < prod_deploy_key

rm prod_deploy_key prod_deploy_key.pub
```

Rotating it is the same three commands plus deleting the old key
(`gh repo deploy-key delete <id> --repo AleksanderDudek/your-events-prod`).

### 4. Environments

```bash
gh api -X PUT repos/AleksanderDudek/your-events/environments/dev
gh api -X PUT repos/AleksanderDudek/your-events/environments/prod \
  -F 'reviewers[][type]=User' \
  -F "reviewers[][id]=$(gh api user --jq .id)"
```

The reviewer rule on `prod` is what makes a release deliberate: every production
run waits for an approval in the Actions tab.

### 5. Environment variables

The values are in the Variables table below; this is the CLI form of it.

```bash
# GitHub-side names; the workflows map them to VITE_* (see "Variable names").
gh variable set NEXT_PUBLIC_SUPABASE_SCHEMA --env dev  --body dev
gh variable set NEXT_PUBLIC_SUPABASE_SCHEMA --env prod --body public
# …and the rest of the Variables table, per environment.
```

## Secrets

The four Supabase secrets are **repository-level and identical for both
environments** — there is nothing to override, because both environments talk to
the same two projects with the same anon keys. What separates them is the schema,
which is a variable, not a secret. See Variables below.

| Secret | Level | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | repository | Szczecin project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | repository | its anon key |
| `NEXT_PUBLIC_SUPABASE_URL_WROCLAW` | repository | Wrocław project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW` | repository | its anon key |
| `DISCORD_WEBHOOK_URL` | repository | deploy notifications, one channel for both |
| `PROD_DEPLOY_KEY` | environment `prod` | private half of the deploy key |

`PROD_DEPLOY_KEY` is the only environment-scoped secret, and the only one that
had to exist before the first release. Keeping it on the `prod` environment
rather than the repository means a workflow that does not declare
`environment: prod` cannot read it — a dev build cannot push to production even
if someone edits it to try.

Should dev ever need its own credentials, add them as environment secrets of the
same name: an environment secret overrides the repository one, with no edit to
any workflow.

The anon key is compiled into the client bundle and is public by nature — it is
kept in secrets for tidiness and rotation, not for confidentiality. What
actually protects the data is Supabase RLS, which is enabled on both schemas.

## Variables

Not secrets — every one of them ships in the page source. Settings →
Environments → *(environment)* → Variables.

| Variable | dev | prod |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_ORIGIN` | `https://aleksanderdudek.github.io` | `https://idznamiasto.pl` |
| `NEXT_PUBLIC_BASE_PATH` | `/your-events` | *(not set)* |
| `NEXT_PUBLIC_ENABLED_CITIES` | `wroclaw,szczecin` | `wroclaw,szczecin` |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | `dev` | `public` |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | *(not set)* | `xtfje919ui` |
| `NEXT_PUBLIC_ROBOTS_NOINDEX` | `true` | *(not set)* |

*(not set)* means the variable does not exist in that environment. GitHub
rejects an empty variable value outright, and it does not need one: an absent
variable interpolates to an empty string, which is exactly what the build wants.

`NEXT_PUBLIC_SUPABASE_SCHEMA` is the one that decides which data a build shows.
The named schema must also appear under Supabase → Settings → API → Exposed
schemas in **both** projects, or PostgREST answers `PGRST106` and the site comes
up empty. To check a schema is served without deploying anything:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $KEY" -H "Accept-Profile: dev" \
  "$URL/rest/v1/events?select=id&limit=1"      # expect 200
```

Clarity is absent on dev deliberately: test traffic pointed at the production
project corrupts the statistics the tag exists to collect.

`NEXT_PUBLIC_ROBOTS_NOINDEX` is compared against the exact string `true`. A typo
therefore fails towards "indexable" — a dev site briefly visible to Google is a
smaller accident than production silently dropped from it.

## The custom domain

Production serves from **idznamiasto.pl**, registered at OVHcloud. The apex is
canonical; `www` is a CNAME that GitHub redirects to it.

The zone (OVH → Web Cloud → Domain names → idznamiasto.pl → DNS zone):

| Record | Type | Target |
| --- | --- | --- |
| `@` | A ×4 | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` |
| `@` | AAAA ×4 | `2606:50c0:8000::153`, `8001::153`, `8002::153`, `8003::153` |
| `www` | CNAME | `aleksanderdudek.github.io.` |
| `@` | MX ×3, SPF | OVH mail — unrelated to the site, do not touch |

The domain arrived with three OVH parking redirections (`@`→`www`, `www`→a
welcome page, `ftp`→the domain). Those were deleted through the **Redirection**
tab, not the DNS zone: OVH implements a redirect as an A record plus a marker
TXT, so deleting the visible A record alone leaves half a redirect behind.

**Two places know the domain, and both are derived from one variable.**
`NEXT_PUBLIC_SITE_ORIGIN` builds every absolute URL the site advertises
(sitemap, robots, metadata — see [src/config/site.ts](../src/config/site.ts)),
and the *Claim the custom domain* step in `deploy-prod.yml` strips its scheme to
write `out/CNAME`. Changing the domain is therefore one variable edit.

That CNAME step is not optional. Setting a custom domain in the Pages UI commits
a CNAME file to the hosting branch, and every deploy force-pushes over that
branch — without the step, the first deploy after the change silently drops the
domain and the site answers on the github.io URL again.

`NEXT_PUBLIC_BASE_PATH` is **absent** on prod, which is what serves the site at
the domain root. GitHub rejects an empty variable value, so the variable is
deleted rather than blanked; an absent variable interpolates to an empty string,
which [build-tools/basePath.ts](../build-tools/basePath.ts) reads as "no base
path" (only a variable that is not passed at all falls back to `/your-events`).
The app takes the result from Vite's `base`, so nothing else needs to agree.

## Releasing

Actions → **Release to production** → *Run workflow*:

- `ref` — what to release. `main` for the current tip, or any commit SHA or tag.
- `force` — leave off.

The workflow moves `production` and then dispatches the production deploy, which
appears in the Actions tab waiting for approval. Approve it there
(*Review deployments* → `prod` → *Approve and deploy*).

What is waiting to be released, at any time:

```bash
git fetch origin
git log --oneline origin/production..origin/main
```

## Rolling back

Release an older commit, with `force` on — moving `production` backwards is not
a fast-forward, and the workflow refuses one unless you say so explicitly.

```bash
git log --oneline origin/production   # pick the commit to go back to
```

Then Actions → **Release to production** → `ref: <that SHA>`, `force: true`.

The next build serves the old code against today's data. Nothing is recovered
from the `your-events-prod` repository itself — its history is one force-pushed
commit and is not a recovery mechanism.

## What runs when

| Trigger | Dev | Prod |
| --- | --- | --- |
| Push to `main` | Deploys | — |
| *Release to production* | — | Deploys the released commit, after approval |
| Cron, every 3 hours (UTC) | Rebuilds | Rebuilds, after approval |
| `repository_dispatch: events-updated` from the scraper | Rebuilds | Rebuilds, after approval |
| Manual dispatch | Yes | Yes |

Both rebuild on a schedule because the site is a static export: event detail
pages exist only for the events present in the database at build time, so events
the scraper adds later would 404 until the next build.

Production rebuilds also wait for approval, cron included. If approving
data-only rebuilds becomes tiresome, remove the reviewer rule from the `prod`
environment and accept that a release then deploys unattended.

## Verifying a deploy

```bash
BASE=https://idznamiasto.pl

# The page is served
curl -sI "$BASE/" | head -1

# The bundles are served — the failure this catches is a blank site
asset=$(curl -s "$BASE/" | grep -o 'assets/entry\.client[^"]*\.js' | head -1)
curl -sI "$BASE/$asset" | head -1

# The PWA: manifest, service worker and its offline page
curl -sI "$BASE/manifest.webmanifest" | head -1
curl -sI "$BASE/sw.js" | head -1
curl -sI "$BASE/offline.html" | head -1

# An event added since the build: 404 status, and the page recovers by itself
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/wroclaw/muzyka/nie-ma-takiego-00000000/"   # expect 404

# Production is indexable; dev is not
curl -s "$BASE/robots.txt" | head -3
curl -s "$BASE/" | grep -c 'name="robots"'          # expect 0
curl -s "https://aleksanderdudek.github.io/your-events/" \
  | grep -o 'name="robots" content="[^"]*"'         # expect noindex, nofollow
```
