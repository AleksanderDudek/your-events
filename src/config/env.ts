import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().min(1, 'VITE_SUPABASE_URL is required'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  // Postgres schema PostgREST reads from. 'public' everywhere today; a second
  // schema is how a dev environment can live in copied tables inside ONE
  // Supabase project instead of a second project. The schema must also be added
  // to the project's exposed schemas in Supabase's API settings, or PostgREST
  // refuses to serve it.
  VITE_SUPABASE_SCHEMA: z.string().min(1).default('public'),
  // Public origin of the deployed site, used to build absolute SEO URLs
  // (sitemap, robots, metadata). The default targets the GitHub Pages demo. The
  // base path is not read here: the build configs resolve VITE_BASE_PATH into
  // Vite's `base`, and the app reads it back as import.meta.env.BASE_URL — see
  // build-tools/basePath.ts and @/config/site.
  VITE_SITE_ORIGIN: z.string().min(1).default('https://aleksanderdudek.github.io'),
  // Comma-separated allowlist of city ids that are live on the site (e.g.
  // "wroclaw,szczecin,poznan"). It is the explicit on/off switch for cities:
  // the picker, header switcher, generated routes and sitemap all follow it.
  // Empty/unset ⇒ every city is enabled and availability falls back to whether
  // the city has a Supabase project (backwards compatible). See @/config/cities.
  VITE_ENABLED_CITIES: z.string().default(''),
  // Microsoft Clarity project id. Empty ⇒ no analytics tag, and empty is the
  // default EVERYWHERE except the Pages deploy workflows, on purpose: the dev
  // server and both Playwright jobs boot this same app, so an unconditional tag turned
  // every headless test page-load into its own ~1s session recording pointed at
  // localhost (assets Clarity's replay can never fetch). Only the deployed site
  // should report. See .github/workflows/deploy-prod.yml.
  VITE_CLARITY_PROJECT_ID: z.string().default(''),
  // Set to 'true' on any environment that must not reach a search index — the
  // dev site serves the same content as production under a different URL, which
  // is a duplicate as far as a crawler is concerned. Empty (indexable) is the
  // default so production cannot be hidden by forgetting a variable.
  VITE_ROBOTS_NOINDEX: z.string().default(''),
  // First-run onboarding (welcome sheet + spotlight tour). On everywhere unless
  // this is the exact string 'false'. The default is on because the feature
  // exists to help first-time visitors, and the failure mode of a typo should
  // be "the sheet still shows" rather than "the feature quietly disappeared and
  // nobody noticed for a month". See @/config/site.
  VITE_ONBOARDING_ENABLED: z.string().default('true'),
});

function validateEnv() {
  const parsed = envSchema.safeParse({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_SCHEMA: import.meta.env.VITE_SUPABASE_SCHEMA,
    VITE_SITE_ORIGIN: import.meta.env.VITE_SITE_ORIGIN,
    VITE_ENABLED_CITIES: import.meta.env.VITE_ENABLED_CITIES,
    VITE_CLARITY_PROJECT_ID: import.meta.env.VITE_CLARITY_PROJECT_ID,
    VITE_ROBOTS_NOINDEX: import.meta.env.VITE_ROBOTS_NOINDEX,
    VITE_ONBOARDING_ENABLED: import.meta.env.VITE_ONBOARDING_ENABLED,
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${message}`);
  }

  return parsed.data;
}

export const env = validateEnv();
