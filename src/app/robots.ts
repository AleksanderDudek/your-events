import { MetadataRoute } from 'next';

import { IS_NOINDEX, SITE_URL } from '@/config/site';

export const dynamic = 'force-static';

// AI-training / data-harvesting / aggressive-scraper user agents we decline.
//
// Caveats worth remembering:
//  - robots.txt is ADVISORY: only well-behaved crawlers obey it. It's the right
//    way to opt out of AI training and declare intent, but it does NOT stop
//    malicious scrapers — that needs an edge layer (e.g. Cloudflare bot rules).
//  - "Google-Extended" / "Applebot-Extended" opt out of AI *training* only; they
//    do NOT affect Google/Apple *search* indexing (Googlebot/Applebot are left
//    fully allowed by the "*" rule below).
//  - The last group (AI answer/search engines) trades away AI-referral
//    visibility (ChatGPT/Perplexity answers) for tighter protection — drop those
//    entries if you'd rather appear there.
const BLOCKED_BOTS = [
  // AI training / bulk harvest
  'GPTBot',
  'CCBot',
  'anthropic-ai',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'Diffbot',
  'Omgilibot',
  'ImagesiftBot',
  'cohere-ai',
  'Timpibot',
  // AI answer/search engines (visibility trade-off)
  'ChatGPT-User',
  'OAI-SearchBot',
  'Claude-Web',
  'PerplexityBot',
];

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
