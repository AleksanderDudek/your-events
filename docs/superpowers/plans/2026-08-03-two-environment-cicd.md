# Two-environment CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split deployment into a dev site (this repo's Pages, follows `main`) and a production site (`your-events-prod` repo's Pages, moves only on an explicit release).

**Architecture:** `your-events` keeps all sources, workflows and secrets. Dev deploys via the existing Pages artifact path. Production is built here from the `production` branch and force-pushed as static files to `gh-pages` in `your-events-prod` over an SSH deploy key. Secrets and config are split with GitHub Environments (`dev`, `prod`).

**Tech Stack:** Next.js 16 static export, pnpm, Vitest, Playwright, GitHub Actions, GitHub Pages, Supabase.

**Spec:** `docs/superpowers/specs/2026-08-03-two-environment-cicd-design.md`

---

## File Structure

**Modified — application code (Tasks 1–4):**

- `src/config/env.ts` — add `NEXT_PUBLIC_SUPABASE_SCHEMA` and `NEXT_PUBLIC_ROBOTS_NOINDEX` to the validated schema.
- `src/config/site.ts` — export `IS_NOINDEX`, next to the existing `SITE_URL`. One place decides "is this environment indexable".
- `src/lib/supabase.ts` — pass the schema to `createClient`.
- `src/app/robots.ts` — disallow everything when `IS_NOINDEX`.
- `src/app/layout.tsx` — `robots` metadata when `IS_NOINDEX`; base-path-aware icon/manifest hrefs.
- `src/app/manifest.ts` — base-path-aware `start_url` and icon sources.

**Created — tests:**

- `src/lib/supabase.spec.ts`
- `src/config/site.spec.ts`
- `src/app/robots.spec.ts`
- `src/app/manifest.spec.ts`

**Workflows (Tasks 5–7):**

- Delete `.github/workflows/deploy.yml`; create `.github/workflows/deploy-dev.yml` (same job, `dev` environment, config from `vars`).
- Create `.github/workflows/deploy-prod.yml`.
- Create `.github/workflows/release.yml`.
- Modify `.github/workflows/e2e.yml` — both jobs declare `environment: dev`.

**Docs (Task 8):**

- Create `docs/DEPLOYMENT.md` — the manual setup checklist (repo, Pages, deploy key, secrets, variables).

Each application change is independently testable and committed on its own. Workflow changes cannot be unit-tested; they are validated by an actual run, which is Task 9.

---

## Task 1: Supabase schema variable

Lets dev live in copied tables inside one Supabase project without touching a
single query. Defaults to `public`, so nothing changes for today's deployments.

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/lib/supabase.ts`
- Test: `src/lib/supabase.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// supabase.ts reads the schema from env at module load and hands it to
// createClient, so each case needs a fresh module graph. createClient is mocked
// because the assertion is about the options we pass, not about reaching a
// server.
//
// vi.hoisted, because vi.mock is lifted above every const in the file — a plain
// `const createClient = vi.fn()` referenced from the factory throws on the
// temporal dead zone.
const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ mock: true })),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

async function loadSupabase(schema?: string) {
  vi.resetModules();
  createClient.mockClear();
  if (schema === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_SCHEMA;
  else process.env.NEXT_PUBLIC_SUPABASE_SCHEMA = schema;
  return import('./supabase');
}

describe('getSupabaseForCity', () => {
  it('reads the public schema when nothing is configured', async () => {
    const { getSupabaseForCity } = await loadSupabase();
    getSupabaseForCity('szczecin');
    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { db: { schema: 'public' } }
    );
  });

  it('reads the configured schema instead', async () => {
    const { getSupabaseForCity } = await loadSupabase('dev');
    getSupabaseForCity('szczecin');
    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { db: { schema: 'dev' } }
    );
  });

  it('still returns one memoized client per city', async () => {
    const { getSupabaseForCity } = await loadSupabase();
    const first = getSupabaseForCity('szczecin');
    const second = getSupabaseForCity('szczecin');
    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/supabase.spec.ts`

Expected: FAIL. `createClient` is called with two arguments, so the
`toHaveBeenCalledWith(..., { db: { schema: 'public' } })` assertion does not
match.

- [ ] **Step 3: Add the variable to the env schema**

In `src/config/env.ts`, add to the `envSchema` object, directly after the
`NEXT_PUBLIC_SUPABASE_ANON_KEY` line:

```ts
  // Postgres schema PostgREST reads from. 'public' everywhere today; a second
  // schema is how a dev environment can live in copied tables inside ONE
  // Supabase project instead of a second project. The schema must also be added
  // to the project's exposed schemas in Supabase's API settings, or PostgREST
  // refuses to serve it.
  NEXT_PUBLIC_SUPABASE_SCHEMA: z.string().min(1).default('public'),
```

And in the `validateEnv()` `safeParse({ ... })` call, add:

```ts
    NEXT_PUBLIC_SUPABASE_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA,
```

- [ ] **Step 4: Pass the schema to createClient**

In `src/lib/supabase.ts`, add the env import below the existing imports:

```ts
import { env } from '@/config/env';
```

and change the `createClient` call inside `getSupabaseForCity` from:

```ts
  const client = createClient(city.supabase.url, city.supabase.anonKey);
```

to:

```ts
  const client = createClient(city.supabase.url, city.supabase.anonKey, {
    db: { schema: env.NEXT_PUBLIC_SUPABASE_SCHEMA },
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/supabase.spec.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Run the whole suite and the type-checker**

Run: `npx vitest run && npx tsc --noEmit`

Expected: all test files pass (374 + 3 new tests), no TypeScript output.

- [ ] **Step 7: Commit**

```bash
git add src/config/env.ts src/lib/supabase.ts src/lib/supabase.spec.ts
git commit -m "feat(config): read the Postgres schema from the environment

A dev environment can now live in copied tables inside one Supabase project
rather than needing a second project: the schema is a build-time variable and
every query keeps calling .from('events') unchanged. Defaults to 'public', so
existing deployments are unaffected.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: The noindex flag

One place decides whether an environment may be indexed. Two consumers follow in
Tasks 3 and 4.

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/config/site.ts`
- Test: `src/config/site.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/config/site.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// site.ts computes its exports at module load from env, so each case reloads it.
async function loadSite(overrides: Record<string, string>) {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_ROBOTS_NOINDEX;
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  return import('./site');
}

describe('IS_NOINDEX', () => {
  it('is false when the variable is unset — production must stay indexable', async () => {
    const { IS_NOINDEX } = await loadSite({});
    expect(IS_NOINDEX).toBe(false);
  });

  it('is true for the exact string "true"', async () => {
    const { IS_NOINDEX } = await loadSite({ NEXT_PUBLIC_ROBOTS_NOINDEX: 'true' });
    expect(IS_NOINDEX).toBe(true);
  });

  // A half-set variable must not accidentally hide production from Google.
  it('is false for any other value', async () => {
    for (const value of ['false', '1', 'yes', '']) {
      const { IS_NOINDEX } = await loadSite({ NEXT_PUBLIC_ROBOTS_NOINDEX: value });
      expect(IS_NOINDEX).toBe(false);
    }
  });
});

describe('SITE_URL', () => {
  it('joins the origin and the base path', async () => {
    const { SITE_URL } = await loadSite({
      NEXT_PUBLIC_SITE_ORIGIN: 'https://example.test',
      NEXT_PUBLIC_BASE_PATH: '/your-events-prod',
    });
    expect(SITE_URL).toBe('https://example.test/your-events-prod');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/config/site.spec.ts`

Expected: FAIL with `IS_NOINDEX` undefined — `site.ts` exports only `SITE_URL`.

- [ ] **Step 3: Add the variable to the env schema**

In `src/config/env.ts`, add to `envSchema`, after `NEXT_PUBLIC_CLARITY_PROJECT_ID`:

```ts
  // Set to 'true' on any environment that must not reach a search index — the
  // dev site serves the same content as production under a different URL, which
  // is a duplicate as far as a crawler is concerned. Empty (indexable) is the
  // default so production cannot be hidden by forgetting a variable.
  NEXT_PUBLIC_ROBOTS_NOINDEX: z.string().default(''),
```

And in the `safeParse({ ... })` call:

```ts
    NEXT_PUBLIC_ROBOTS_NOINDEX: process.env.NEXT_PUBLIC_ROBOTS_NOINDEX,
```

- [ ] **Step 4: Export the flag**

Append to `src/config/site.ts`:

```ts
// Whether this environment must be kept out of search indexes. Compared against
// the exact string 'true' rather than treated as "any non-empty value": a
// variable left as 'false' should read as false, and the failure mode of a typo
// must be "indexable" (a dev site briefly visible) rather than "not indexable"
// (production silently dropped from Google).
export const IS_NOINDEX = env.NEXT_PUBLIC_ROBOTS_NOINDEX === 'true';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/config/site.spec.ts`

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/config/env.ts src/config/site.ts src/config/site.spec.ts
git commit -m "feat(config): add the noindex flag for non-production environments

A dev site serving production's content under a second URL is a duplicate to a
crawler. One flag decides it, defaulting to indexable so production cannot be
hidden from search by a forgotten variable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: robots.txt honours the flag

**Files:**
- Modify: `src/app/robots.ts`
- Test: `src/app/robots.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/app/robots.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

async function loadRobots(overrides: Record<string, string>) {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_ROBOTS_NOINDEX;
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  const mod = await import('./robots');
  return mod.default();
}

describe('robots.txt', () => {
  it('welcomes crawlers and declines AI harvesters when indexable', async () => {
    const robots = await loadRobots({});
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    expect(rules[0]).toMatchObject({ userAgent: '*', allow: '/' });
    // The AI/scraper opt-out survives — it is orthogonal to the environment.
    expect(rules[1]).toMatchObject({ disallow: '/' });
    expect(rules[1].userAgent).toContain('GPTBot');
  });

  it('declines every crawler when the environment is noindex', async () => {
    const robots = await loadRobots({ NEXT_PUBLIC_ROBOTS_NOINDEX: 'true' });
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ userAgent: '*', disallow: '/' });
    expect(rules[0].allow).toBeUndefined();
  });

  it('always advertises the sitemap for its own origin', async () => {
    const robots = await loadRobots({
      NEXT_PUBLIC_SITE_ORIGIN: 'https://example.test',
      NEXT_PUBLIC_BASE_PATH: '/your-events-prod',
    });
    expect(robots.sitemap).toBe('https://example.test/your-events-prod/sitemap.xml');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/robots.spec.ts`

Expected: FAIL on the second case — it returns two rules, the first still
`allow: '/'`.

- [ ] **Step 3: Implement**

In `src/app/robots.ts`, change the import line:

```ts
import { SITE_URL } from '@/config/site';
```

to:

```ts
import { IS_NOINDEX, SITE_URL } from '@/config/site';
```

and replace the whole `export default function robots()` body with:

```ts
export default function robots(): MetadataRoute.Robots {
  // A non-production environment serves production's content under a second
  // URL. Letting it be crawled would put a duplicate of the whole site into the
  // index, competing with the real one.
  if (IS_NOINDEX) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      sitemap: `${SITE_URL}/sitemap.xml`,
    };
  }

  return {
    rules: [
      // Everyone else — search engines (Googlebot, Bingbot, DuckDuckBot,
      // Applebot) and social-preview bots (facebookexternalhit, Twitterbot,
      // LinkedInBot, Slackbot) — gets full access.
      { userAgent: '*', allow: '/' },
      // AI/scraper bots: declined.
      { userAgent: BLOCKED_BOTS, disallow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/robots.spec.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/robots.ts src/app/robots.spec.ts
git commit -m "feat(seo): keep noindex environments out of crawlers

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Base-path-aware icons, manifest and robots metadata

Two problems in one pair of files. The hardcoded `/your-events/` prefix 404s
under any other base path, and the page metadata needs the noindex tag —
`robots.txt` alone does not keep a linked page out of the index, it only stops
the crawl.

**Files:**
- Modify: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx`
- Test: `src/app/manifest.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/app/manifest.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// constants.ts resolves BASE_PATH at module load, so each case reloads the graph.
async function loadManifest(basePath: string) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_BASE_PATH = basePath;
  const mod = await import('./manifest');
  return mod.default();
}

describe('web app manifest', () => {
  it('prefixes start_url and icons with the configured base path', async () => {
    const manifest = await loadManifest('/your-events-prod');
    expect(manifest.start_url).toBe('/your-events-prod/');
    for (const icon of manifest.icons ?? []) {
      expect(icon.src.startsWith('/your-events-prod/favicons/')).toBe(true);
    }
  });

  // Served from a domain root there is no prefix at all, and a leftover one
  // would 404 every icon.
  it('uses root-relative paths when there is no base path', async () => {
    const manifest = await loadManifest('');
    expect(manifest.start_url).toBe('/');
    for (const icon of manifest.icons ?? []) {
      expect(icon.src.startsWith('/favicons/')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/manifest.spec.ts`

Expected: FAIL — `start_url` is the literal `/your-events/` in both cases.

- [ ] **Step 3: Make the manifest base-path aware**

In `src/app/manifest.ts`, add the import:

```ts
import { withBasePath } from '@/lib/constants';
```

and replace the four hardcoded paths:

```ts
    start_url: withBasePath('/'),
```

```ts
        src: withBasePath('/favicons/web-app-manifest-192x192.png'),
```

```ts
        src: withBasePath('/favicons/web-app-manifest-512x512.png'),
```

(the last one appears twice — the `512x512` entry and the `maskable` entry; both
become `withBasePath('/favicons/web-app-manifest-512x512.png')`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/manifest.spec.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Fix the same bug in the layout's link tags**

In `src/app/layout.tsx`, add to the imports:

```ts
import { withBasePath } from '@/lib/constants';
import { IS_NOINDEX } from '@/config/site';
```

Replace the six hardcoded hrefs in `<head>`:

```tsx
        <link rel="icon" type="image/png" href={withBasePath('/favicons/favicon-96x96.png')} sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href={withBasePath('/favicons/favicon.svg')} />
        <link rel="shortcut icon" href={withBasePath('/favicons/favicon.ico')} />
        <link rel="apple-touch-icon" sizes="180x180" href={withBasePath('/favicons/apple-touch-icon.png')} />
        <meta name="apple-mobile-web-app-title" content={m.APP_NAME} />
        <link rel="manifest" href={withBasePath('/favicons/site.webmanifest')} />
```

- [ ] **Step 6: Add the robots metadata**

In the same file, inside the exported `metadata` object, after the
`description: defaultDescription,` line:

```ts
  // robots.txt stops the crawl; this stops the indexing. A disallowed page can
  // still be indexed from inbound links — URL only, no content — so a dev site
  // needs both.
  robots: IS_NOINDEX ? { index: false, follow: false } : undefined,
```

- [ ] **Step 7: Run the whole suite, the type-checker and the linter**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/`

Expected: all tests pass, no TypeScript output, eslint reports only the
pre-existing `no-page-custom-font` warning in `layout.tsx`.

- [ ] **Step 8: Verify a real build under the production base path**

Run:

```bash
NEXT_PUBLIC_BASE_PATH=/your-events-prod NEXT_PUBLIC_ROBOTS_NOINDEX=true pnpm build
grep -c 'your-events-prod/favicons' out/index.html
grep -o 'name="robots" content="[^"]*"' out/index.html
head -3 out/robots.txt
```

Expected: the grep count is 5, the robots meta reads `noindex, nofollow`, and
`robots.txt` starts with `User-Agent: *` / `Disallow: /`.

- [ ] **Step 9: Commit**

```bash
git add src/app/manifest.ts src/app/manifest.spec.ts src/app/layout.tsx
git commit -m "fix(seo): resolve icon and manifest paths from the base path

Five link tags and four manifest entries hardcoded /your-events/. Next.js
prefixes <Link> and imported assets, not hrefs written by hand, so every one of
them would 404 under a second base path — no favicon, a broken manifest, no
installable PWA. Latent until now only because one base path has ever shipped.

The same commit adds the noindex meta tag for non-production environments:
robots.txt stops the crawl, this stops the indexing, and a disallowed page can
still be indexed from inbound links.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: The dev deploy workflow

Renames `deploy.yml` and moves its configuration into the `dev` environment.
Behaviour is otherwise identical to today's.

**Files:**
- Delete: `.github/workflows/deploy.yml`
- Create: `.github/workflows/deploy-dev.yml`

- [ ] **Step 1: Create the new workflow**

Create `.github/workflows/deploy-dev.yml`:

```yaml
name: Deploy dev to GitHub Pages

# The dev site: this repository's own Pages, following main. Production lives in
# your-events-prod and is deployed by deploy-prod.yml from the `production`
# branch — see docs/superpowers/specs/2026-08-03-two-environment-cicd-design.md.

on:
  push:
    branches: [main]
  workflow_dispatch:
  # Backend (IdzNaMiasto scrape pipeline) fires repository_dispatch
  # 'events-updated' right after its morning push to Supabase, so the static
  # site rebuilds within minutes of fresh data instead of waiting for the
  # next scheduled cron below.
  repository_dispatch:
    types: [events-updated]
  # The site is a static export: event detail pages exist only for ids present
  # in the DB at build time (generateStaticParams + dynamicParams=false). New
  # events added to Supabase between code pushes would 404 until the next build,
  # so rebuild on a schedule to keep the static pages fresh as a fallback.
  # Cron is UTC.
  schedule:
    - cron: '0 */3 * * *'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-dev
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v6
        with:
          version: 10
      - uses: actions/setup-node@v5
        with:
          node-version: '20'
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          # Per-city (multi-city). NEXT_PUBLIC_* are baked in at build time, so
          # every new city needs its URL + anon key here or it stays
          # available:false and is hidden from the picker.
          NEXT_PUBLIC_SUPABASE_URL_WROCLAW: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL_WROCLAW }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW }}
          # Not secrets — they ship in the page source. Kept as environment
          # variables so dev and prod differ by configuration, not by code.
          NEXT_PUBLIC_SITE_ORIGIN: ${{ vars.NEXT_PUBLIC_SITE_ORIGIN }}
          NEXT_PUBLIC_BASE_PATH: ${{ vars.NEXT_PUBLIC_BASE_PATH }}
          NEXT_PUBLIC_ENABLED_CITIES: ${{ vars.NEXT_PUBLIC_ENABLED_CITIES }}
          NEXT_PUBLIC_SUPABASE_SCHEMA: ${{ vars.NEXT_PUBLIC_SUPABASE_SCHEMA }}
          # Empty on dev on purpose: test traffic pointed at the production
          # Clarity project would corrupt the statistics the tag exists for.
          NEXT_PUBLIC_CLARITY_PROJECT_ID: ${{ vars.NEXT_PUBLIC_CLARITY_PROJECT_ID }}
          NEXT_PUBLIC_ROBOTS_NOINDEX: ${{ vars.NEXT_PUBLIC_ROBOTS_NOINDEX }}
      - uses: actions/upload-pages-artifact@v5
        with:
          path: ./out

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    outputs:
      page_url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v5
        id: deployment

  notify:
    needs: [build, deploy]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Notify Discord
        env:
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          BUILD_RESULT: ${{ needs.build.result }}
          DEPLOY_RESULT: ${{ needs.deploy.result }}
          PAGE_URL: ${{ needs.deploy.outputs.page_url }}
          EVENT: ${{ github.event_name }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          if [ -z "$DISCORD_WEBHOOK_URL" ]; then
            echo "No DISCORD_WEBHOOK_URL — skipping the notification."
            exit 0
          fi
          if [ "$BUILD_RESULT" = "success" ] && [ "$DEPLOY_RESULT" = "success" ]; then
            TITLE="🌐 dev deploy — ✅ success"
            COLOR=4906588          # 0x4ade80 green
          else
            TITLE="🌐 dev deploy — ❌ fail (build=$BUILD_RESULT, deploy=$DEPLOY_RESULT)"
            COLOR=15680580         # 0xef4444 red
          fi
          PAGE="${PAGE_URL:-https://aleksanderdudek.github.io/your-events}"
          # jq builds the JSON safely (escaping). The User-Agent avoids Cloudflare 1010.
          payload=$(jq -n \
            --arg title "$TITLE" \
            --arg url "$RUN_URL" \
            --argjson color "$COLOR" \
            --arg event "$EVENT" \
            --arg page "$PAGE" \
            '{
              username: "your-events Deploy",
              embeds: [{
                title: $title,
                url: $url,
                color: $color,
                fields: [
                  { name: "Trigger", value: $event, inline: true },
                  { name: "Site", value: $page, inline: false }
                ]
              }]
            }')
          code=$(curl -sS -o /tmp/discord_resp -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "User-Agent: your-events-deploy/1.0 (+https://github.com/AleksanderDudek/your-events)" \
            -d "$payload" "$DISCORD_WEBHOOK_URL")
          echo "Discord webhook → HTTP $code"
          if [ "$code" != "204" ]; then
            echo "Response:"; cat /tmp/discord_resp || true
          fi
```

- [ ] **Step 2: Delete the old workflow**

```bash
git rm .github/workflows/deploy.yml
```

- [ ] **Step 3: Check the YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-dev.yml')); print('YAML OK')"`

Expected: `YAML OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-dev.yml
git commit -m "ci(deploy): rename the Pages deploy to dev and move config into vars

Same job as before, now bound to the dev environment. Origin, base path,
enabled cities, Clarity id, schema and the noindex flag come from environment
variables instead of being hardcoded, which is what lets the production
workflow reuse the identical build with different values.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: The production deploy workflow

**Files:**
- Create: `.github/workflows/deploy-prod.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/deploy-prod.yml`:

```yaml
name: Deploy prod to your-events-prod

# Production: built HERE from the `production` branch, published to the Pages of
# the your-events-prod repository. That repo holds static files only — no
# sources, no workflows, no secrets.
#
# There is deliberately no `push: production` trigger. A push made with
# GITHUB_TOKEN does not start a workflow, so a release-driven push would
# silently deploy nothing. release.yml dispatches this workflow explicitly
# instead; workflow_dispatch is one of the two events exempt from that rule.

on:
  workflow_dispatch:
  repository_dispatch:
    types: [events-updated]
  # Event pages are baked at build time, so production must rebuild on data as
  # well as on releases. Cron is UTC.
  schedule:
    - cron: '0 */3 * * *'

permissions:
  contents: read

concurrency:
  group: pages-prod
  cancel-in-progress: false

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    environment: prod
    steps:
      # Always the released commit, never the ref that happened to trigger the
      # run — a cron fires on the default branch.
      - uses: actions/checkout@v5
        with:
          ref: production

      - uses: pnpm/action-setup@v6
        with:
          version: 10

      - uses: actions/setup-node@v5
        with:
          node-version: '20'
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_SUPABASE_URL_WROCLAW: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL_WROCLAW }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW }}
          NEXT_PUBLIC_SITE_ORIGIN: ${{ vars.NEXT_PUBLIC_SITE_ORIGIN }}
          NEXT_PUBLIC_BASE_PATH: ${{ vars.NEXT_PUBLIC_BASE_PATH }}
          NEXT_PUBLIC_ENABLED_CITIES: ${{ vars.NEXT_PUBLIC_ENABLED_CITIES }}
          NEXT_PUBLIC_SUPABASE_SCHEMA: ${{ vars.NEXT_PUBLIC_SUPABASE_SCHEMA }}
          NEXT_PUBLIC_CLARITY_PROJECT_ID: ${{ vars.NEXT_PUBLIC_CLARITY_PROJECT_ID }}
          NEXT_PUBLIC_ROBOTS_NOINDEX: ${{ vars.NEXT_PUBLIC_ROBOTS_NOINDEX }}

      # A blank production page is the failure mode this guards against: Pages
      # served from a branch runs the tree through Jekyll, which drops every
      # directory whose name starts with an underscore — including _next/.
      - name: Mark the output as not-Jekyll
        run: touch out/.nojekyll

      - name: Publish to your-events-prod
        env:
          DEPLOY_KEY: ${{ secrets.PROD_DEPLOY_KEY }}
          TARGET_REPO: git@github.com:AleksanderDudek/your-events-prod.git
        run: |
          set -euo pipefail
          if [ -z "${DEPLOY_KEY:-}" ]; then
            echo "PROD_DEPLOY_KEY is not set in the prod environment — see docs/DEPLOYMENT.md"
            exit 1
          fi
          mkdir -p ~/.ssh
          printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -t rsa,ecdsa,ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null

          # A single orphan commit, force-pushed. Rollback is moving the
          # `production` branch here and rebuilding, so the host repository's
          # history is not a recovery mechanism and is not worth keeping.
          cd out
          git init -q -b gh-pages
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git commit -q -m "Deploy ${GITHUB_SHA} (${GITHUB_RUN_ID})"
          git push -q --force "$TARGET_REPO" gh-pages
          echo "Published $(git rev-parse --short HEAD) to your-events-prod:gh-pages"

  notify:
    needs: [build-and-publish]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Notify Discord
        env:
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          RESULT: ${{ needs.build-and-publish.result }}
          EVENT: ${{ github.event_name }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          if [ -z "$DISCORD_WEBHOOK_URL" ]; then
            echo "No DISCORD_WEBHOOK_URL — skipping the notification."
            exit 0
          fi
          if [ "$RESULT" = "success" ]; then
            TITLE="🚀 prod deploy — ✅ success"
            COLOR=4906588
          else
            TITLE="🚀 prod deploy — ❌ $RESULT"
            COLOR=15680580
          fi
          payload=$(jq -n \
            --arg title "$TITLE" \
            --arg url "$RUN_URL" \
            --argjson color "$COLOR" \
            --arg event "$EVENT" \
            --arg page "https://aleksanderdudek.github.io/your-events-prod" \
            '{
              username: "your-events Deploy",
              embeds: [{
                title: $title,
                url: $url,
                color: $color,
                fields: [
                  { name: "Trigger", value: $event, inline: true },
                  { name: "Site", value: $page, inline: false }
                ]
              }]
            }')
          code=$(curl -sS -o /tmp/discord_resp -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "User-Agent: your-events-deploy/1.0 (+https://github.com/AleksanderDudek/your-events)" \
            -d "$payload" "$DISCORD_WEBHOOK_URL")
          echo "Discord webhook → HTTP $code"
          if [ "$code" != "204" ]; then
            echo "Response:"; cat /tmp/discord_resp || true
          fi
```

- [ ] **Step 2: Check the YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-prod.yml')); print('YAML OK')"`

Expected: `YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-prod.yml
git commit -m "ci(deploy): build production here and publish it to your-events-prod

Checks out the production branch explicitly so a cron run deploys what is
released rather than whatever the trigger ref happened to be, writes .nojekyll
(a branch-served Pages site runs Jekyll, which would eat _next/), and
force-pushes out/ as one orphan commit over an SSH deploy key.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: The release workflow and e2e environment binding

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Create the release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release to production

# A release is moving the `production` branch. Everything else follows from it:
# `git log production..main` is what is waiting to ship, and a rollback is
# releasing an older commit.

on:
  workflow_dispatch:
    inputs:
      ref:
        description: 'Commit, tag or branch to release'
        required: true
        default: main
      force:
        description: 'Allow moving production backwards (rollback)'
        type: boolean
        default: false

permissions:
  contents: write
  actions: write # to dispatch deploy-prod.yml

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - name: Move the production branch
        env:
          REF: ${{ inputs.ref }}
          FORCE: ${{ inputs.force }}
        run: |
          set -euo pipefail
          TARGET=$(git rev-parse --verify "origin/$REF^{commit}" 2>/dev/null \
            || git rev-parse --verify "$REF^{commit}")
          echo "Releasing $REF ($TARGET)"

          if git rev-parse --verify -q "origin/production^{commit}" >/dev/null; then
            CURRENT=$(git rev-parse "origin/production^{commit}")
            echo "production currently at $CURRENT"
            if [ "$CURRENT" = "$TARGET" ]; then
              echo "Already released — nothing to move."
            elif git merge-base --is-ancestor "$CURRENT" "$TARGET"; then
              echo "Fast-forward."
            elif [ "$FORCE" = "true" ]; then
              echo "Not a fast-forward, but force was requested."
            else
              echo "Refusing: $REF is not a descendant of the released commit."
              echo "Re-run with force=true if you mean to move production backwards."
              exit 1
            fi
          else
            echo "production does not exist yet — creating it."
          fi

          git push --force origin "$TARGET:refs/heads/production"

      # An explicit dispatch, because a push authenticated with GITHUB_TOKEN
      # does not start a workflow — the deploy would never run otherwise.
      - name: Trigger the production deploy
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh workflow run deploy-prod.yml --ref main
```

- [ ] **Step 2: Bind the e2e jobs to the dev environment**

In `.github/workflows/e2e.yml`, add `environment: dev` to both jobs.

In the `e2e` job, after `timeout-minutes: 20`:

```yaml
    # Environment-scoped credentials: e2e exercises the dev database, never
    # production's.
    environment: dev
```

In the `e2e-export` job, after `timeout-minutes: 30`:

```yaml
    environment: dev
```

- [ ] **Step 3: Check both files parse**

Run:

```bash
python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/release.yml','.github/workflows/e2e.yml']]; print('YAML OK')"
```

Expected: `YAML OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml .github/workflows/e2e.yml
git commit -m "ci(release): make moving the production branch the release

Refuses a non-fast-forward move unless force is requested, so a release cannot
silently drop commits, and dispatches the production deploy explicitly because
a GITHUB_TOKEN push starts no workflow.

E2E now reads dev-environment credentials rather than repository-level ones, so
tests can never touch the production database.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: The deployment guide

Everything the repository owner has to do by hand, in one file, in order.

**Files:**
- Create: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Write the guide**

Create `docs/DEPLOYMENT.md` with these sections, in this order:

1. **The two environments** — a table of environment, branch, repository, URL.
2. **One-time setup** — create `your-events-prod` (public), enable its Pages from
   the `gh-pages` branch, generate the deploy key, add the public half to the
   prod repo and the private half to this repo's `prod` environment.
3. **Secrets** — the exact names, per environment, as a table, with a note that
   the anon key is public by nature and protected by RLS.
4. **Variables** — the exact names and values per environment, copied from the
   spec's table.
5. **Releasing** — Actions → *Release to production* → run with `ref: main`;
   approve the `prod` environment when GitHub asks.
6. **Rolling back** — the same workflow with an older commit and `force: true`.
7. **What runs when** — the trigger table for both deploy workflows.

The exact commands for the deploy key:

```bash
ssh-keygen -t ed25519 -C "your-events-prod deploy" -N "" -f prod_deploy_key
cat prod_deploy_key.pub   # → your-events-prod → Settings → Deploy keys (Allow write access)
cat prod_deploy_key       # → your-events → Settings → Environments → prod → PROD_DEPLOY_KEY
rm prod_deploy_key prod_deploy_key.pub
```

- [ ] **Step 2: Link it from the README**

Add to `README.md`, in the section listing project documentation (or as a new
`## Deployment` section if none exists):

```markdown
## Deployment

Two environments, dev and production, on separate GitHub Pages sites. Setup,
secrets and the release procedure: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
```

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOYMENT.md README.md
git commit -m "docs: how to set up and release the two environments

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Provision GitHub (operator task)

Not code. Run by whoever holds the GitHub account; `gh` must be authenticated
with the `repo` and `workflow` scopes.

- [ ] **Step 1: Create the production repository**

```bash
gh repo create AleksanderDudek/your-events-prod --public \
  --description "Production build of your-events. Generated — do not edit; sources live in AleksanderDudek/your-events."
```

- [ ] **Step 2: Seed the gh-pages branch**

Pages cannot be enabled for a branch that does not exist.

```bash
tmp=$(mktemp -d) && cd "$tmp"
git init -q -b gh-pages
printf 'Production build of your-events. Generated by deploy-prod.yml — do not edit.\n' > README.md
touch .nojekyll
git add -A && git commit -q -m "Initialise the hosting branch"
git push -q https://github.com/AleksanderDudek/your-events-prod.git gh-pages
cd - && rm -rf "$tmp"
```

- [ ] **Step 3: Enable Pages on the production repository**

```bash
gh api -X POST repos/AleksanderDudek/your-events-prod/pages \
  -f 'source[branch]=gh-pages' -f 'source[path]=/'
```

Expected: JSON containing `"html_url": "https://aleksanderdudek.github.io/your-events-prod/"`.

- [ ] **Step 4: Create the environments**

```bash
gh api -X PUT repos/AleksanderDudek/your-events/environments/dev
gh api -X PUT repos/AleksanderDudek/your-events/environments/prod \
  -F 'reviewers[][type]=User' \
  -F "reviewers[][id]=$(gh api user --jq .id)"
```

Expected: two JSON objects; the second lists a `required_reviewers` protection rule.

- [ ] **Step 5: Set the environment variables**

```bash
gh variable set NEXT_PUBLIC_SITE_ORIGIN --env dev  --body 'https://aleksanderdudek.github.io'
gh variable set NEXT_PUBLIC_BASE_PATH   --env dev  --body '/your-events'
gh variable set NEXT_PUBLIC_ENABLED_CITIES --env dev --body 'wroclaw,szczecin'
gh variable set NEXT_PUBLIC_SUPABASE_SCHEMA --env dev --body 'public'
gh variable set NEXT_PUBLIC_CLARITY_PROJECT_ID --env dev --body ''
gh variable set NEXT_PUBLIC_ROBOTS_NOINDEX --env dev --body 'true'

gh variable set NEXT_PUBLIC_SITE_ORIGIN --env prod --body 'https://aleksanderdudek.github.io'
gh variable set NEXT_PUBLIC_BASE_PATH   --env prod --body '/your-events-prod'
gh variable set NEXT_PUBLIC_ENABLED_CITIES --env prod --body 'wroclaw,szczecin'
gh variable set NEXT_PUBLIC_SUPABASE_SCHEMA --env prod --body 'public'
gh variable set NEXT_PUBLIC_CLARITY_PROJECT_ID --env prod --body 'xtfje919ui'
gh variable set NEXT_PUBLIC_ROBOTS_NOINDEX --env prod --body ''
```

- [ ] **Step 6: Report what the owner must still do by hand**

Secrets are values only the owner should type. List, per environment, the names
from `docs/DEPLOYMENT.md` that are still unset:

```bash
gh secret list --env dev
gh secret list --env prod
```

Expected at this point: both empty. The owner sets the four Supabase secrets in
each environment, plus `PROD_DEPLOY_KEY` in `prod`, before the first release.

---

## Task 10: First release and verification

Blocked until the owner has set the secrets from Task 9, Step 6.

- [ ] **Step 1: Release**

```bash
gh workflow run release.yml -f ref=main
gh run watch
```

Expected: the promote job pushes `production` and dispatches `deploy-prod.yml`,
which then waits for the `prod` environment approval.

- [ ] **Step 2: Approve and wait for the deploy**

Approve the run in the GitHub UI (Actions → the waiting run → *Review
deployments* → `prod` → Approve).

- [ ] **Step 3: Verify production is intact**

```bash
BASE=https://aleksanderdudek.github.io/your-events-prod
curl -sI "$BASE/" | head -1
curl -s "$BASE/" | grep -o '_next/static[^"]*' | head -1
curl -sI "$BASE/$(curl -s "$BASE/" | grep -o '_next/static[^"]*' | head -1)" | head -1
curl -s "$BASE/robots.txt" | head -3
curl -s "$BASE/" | grep -c 'name="robots"'
```

Expected: the page returns `200`, a `_next/static/...` asset is referenced and
also returns `200` (this is the `.nojekyll` proof), `robots.txt` allows `*`, and
the robots meta tag count is `0` — production must be indexable.

- [ ] **Step 4: Verify dev is hidden**

```bash
BASE=https://aleksanderdudek.github.io/your-events
curl -s "$BASE/robots.txt" | head -3
curl -s "$BASE/" | grep -o 'name="robots" content="[^"]*"'
```

Expected: `Disallow: /` for `User-Agent: *`, and `content="noindex, nofollow"`.

- [ ] **Step 5: Verify an event page renders on production**

Open `https://aleksanderdudek.github.io/your-events-prod/szczecin/wydarzenia/`
in a browser, click through to any event, and confirm the detail page renders
with its image and the "Add to calendar" control — that exercises the base-path
fix from Task 4 end to end.

---

## Notes for the implementer

- Tasks 1–4 are ordinary code with tests and can be done in any order; 2 must
  precede 3 and 4, which consume `IS_NOINDEX`.
- Tasks 5–7 cannot be tested locally beyond YAML parsing. Their real
  verification is Task 10.
- Do not set any secret value. Task 9 stops at reporting which are missing; the
  repository owner supplies them.
- The `production` branch does not exist until the first release. Every
  reference to it in the workflows tolerates that.
