import { env } from './env';

// Canonical absolute base URL of the deployed site. Used for every SEO output
// (sitemap, robots, metadata) so the URLs we advertise to crawlers match what
// the host actually serves.
//
// SITE_URL = origin + basePath. Both come from env so switching hosts is a
// config change, not a code change:
//
//   Demo (default, GitHub Pages):
//     origin   = https://aleksanderdudek.github.io
//     basePath = /your-events
//     SITE_URL = https://aleksanderdudek.github.io/your-events
//
//   Production (custom domain, served at root) — set in the build env:
//     NEXT_PUBLIC_SITE_ORIGIN = https://your-events.pl
//     NEXT_PUBLIC_BASE_PATH   =            (empty)
//   and add a public/CNAME file. Then SITE_URL = https://your-events.pl.
//
// Keep NEXT_PUBLIC_BASE_PATH in sync with `basePath` in next.config.js — they
// describe the same path from two places (TS app vs. CommonJS config).
const origin = env.NEXT_PUBLIC_SITE_ORIGIN.replace(/\/+$/, '');
const basePath = env.NEXT_PUBLIC_BASE_PATH.replace(/\/+$/, '');

export const SITE_URL = `${origin}${basePath}`;

// Whether this environment must be kept out of search indexes. Compared against
// the exact string 'true' rather than treated as "any non-empty value": a
// variable left as 'false' should read as false, and the failure mode of a typo
// must be "indexable" (a dev site briefly visible) rather than "not indexable"
// (production silently dropped from Google).
export const IS_NOINDEX = env.NEXT_PUBLIC_ROBOTS_NOINDEX === 'true';

// Whether first-run onboarding ships. Compared against the exact string 'false'
// rather than "any non-'true' value", which is the mirror image of IS_NOINDEX
// above and for the same reason: each flag defaults to the harmless direction,
// and a typo cannot flip it there. Off means the sheet, the tour and the
// footer's replay link all disappear, and nothing is read from localStorage.
export const IS_ONBOARDING_ENABLED = env.NEXT_PUBLIC_ONBOARDING_ENABLED !== 'false';
