import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  // Public origin + base path of the deployed site, used to build absolute SEO
  // URLs (sitemap, robots, metadata). Defaults target the GitHub Pages demo;
  // override both when wiring up the production domain. See @/config/site.
  NEXT_PUBLIC_SITE_ORIGIN: z.string().min(1).default('https://aleksanderdudek.github.io'),
  NEXT_PUBLIC_BASE_PATH: z.string().default('/your-events'),
  // Comma-separated allowlist of city ids that are live on the site (e.g.
  // "wroclaw,szczecin,poznan"). It is the explicit on/off switch for cities:
  // the picker, header switcher, generated routes and sitemap all follow it.
  // Empty/unset ⇒ every city is enabled and availability falls back to whether
  // the city has a Supabase project (backwards compatible). See @/config/cities.
  NEXT_PUBLIC_ENABLED_CITIES: z.string().default(''),
  // Microsoft Clarity project id. Empty ⇒ no analytics tag, and empty is the
  // default EVERYWHERE except the Pages deploy workflow, on purpose: `next dev`
  // and both Playwright jobs boot this same app, so an unconditional tag turned
  // every headless test page-load into its own ~1s session recording pointed at
  // localhost (assets Clarity's replay can never fetch). Only the deployed site
  // should report. See .github/workflows/deploy.yml.
  NEXT_PUBLIC_CLARITY_PROJECT_ID: z.string().default(''),
});

function validateEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_ORIGIN: process.env.NEXT_PUBLIC_SITE_ORIGIN,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
    NEXT_PUBLIC_ENABLED_CITIES: process.env.NEXT_PUBLIC_ENABLED_CITIES,
    NEXT_PUBLIC_CLARITY_PROJECT_ID: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
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
