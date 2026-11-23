// Who may crawl the site and who may not. Read by src/lib/robotsTxt.ts.
//
// robots.txt is a request, not a lock: it binds the crawlers that honour it —
// every major AI vendor and SEO tool says theirs do — and states the site's
// terms for the rest. Stopping a scraper that ignores it takes an edge layer in
// front of GitHub Pages; see "Bots and scrapers" in docs/DEPLOYMENT.md.

export { AI_CRAWLERS } from './aiCrawlers.generated';

/**
 * Commercial crawlers that copy the site into SEO, marketing and media-
 * monitoring databases. They bring no visitors and are the heaviest crawl
 * load a small site gets.
 *
 * Their site-audit bots are a different user agent (AhrefsSiteAudit,
 * SiteAuditBot) and stay allowed: an owner's own audit of idznamiasto.pl
 * keeps working.
 */
export const DATA_HARVESTERS: readonly string[] = [
  'AhrefsBot',
  'Barkrowler',
  'BLEXBot',
  'DataForSeoBot',
  'DotBot',
  'MegaIndex.ru',
  'MJ12bot',
  'Screaming Frog SEO Spider',
  'SeekportBot',
  'SemrushBot',
  'serpstatbot',
  'trendictionbot',
  'ZoominfoBot',
];

/**
 * Must never appear in a blocking group: search engines (the site lives on
 * search traffic) and the bots that draw link previews when an event or a plan
 * is pasted into a chat. Checked by robotsTxt.spec.ts, so a sync of the AI list
 * cannot quietly take one of them out.
 */
export const ALWAYS_ALLOWED: readonly string[] = [
  'Googlebot',
  'Googlebot-Image',
  'Google-InspectionTool',
  'Bingbot',
  'Applebot',
  'DuckDuckBot',
  'YandexBot',
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'WhatsApp',
  'TelegramBot',
  'Discordbot',
  'Pinterestbot',
  'SkypeUriPreview',
  'AhrefsSiteAudit',
  'SiteAuditBot',
];
