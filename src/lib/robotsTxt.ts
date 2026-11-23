import { AI_CRAWLERS, DATA_HARVESTERS } from '@/config/bots';

// The site's robots.txt, as text. Written by hand rather than through Next's
// MetadataRoute.Robots, which can only express User-agent / Allow / Disallow /
// Sitemap — not the Content-Signal line, nor the comments that carry the
// rights reservation.

export interface RobotsOptions {
  /** Absolute site URL (origin + base path), no trailing slash. */
  siteUrl: string;
  /** A non-production environment: nothing may crawl it at all. */
  noindex: boolean;
}

// Content Signals (contentsignals.org): one machine-readable line saying what
// the content may be used for once fetched. Search engines index and link as
// before; AI training and AI answers built from the pages are declined.
export const CONTENT_SIGNAL = 'search=yes, ai-train=no, ai-input=no';

const HEADER = [
  '# Idź na miasto (idznamiasto.pl)',
  '#',
  '# Search engines and link previews are welcome.',
  '# Not permitted: training AI models on this content, using it as input to',
  '# AI-generated answers, AI agents acting on this site, and bulk copying of',
  '# the event listings into other databases.',
  '#',
  '# The operator expressly reserves the rights to text and data mining under',
  '# Article 4(3) of Directive (EU) 2019/790. The same reservation is published',
  '# at /.well-known/tdmrep.json and in each page (tdm-reservation).',
];

function group(comment: string, agents: readonly string[]): string[] {
  return [`# ${comment}`, ...agents.map((agent) => `User-agent: ${agent}`), 'Disallow: /'];
}

export function buildRobotsTxt({ siteUrl, noindex }: RobotsOptions): string {
  const sitemap = `Sitemap: ${siteUrl}/sitemap.xml`;

  // A non-production environment serves production's content under a second
  // URL. Letting it be crawled would put a duplicate of the whole site into the
  // index, competing with the real one.
  const sections = noindex
    ? [['User-agent: *', 'Disallow: /']]
    : [
        HEADER,
        // Everyone not named below — search engines (Googlebot, Bingbot,
        // Applebot, DuckDuckBot) and link-preview bots (facebookexternalhit,
        // Twitterbot, LinkedInBot, Slackbot, WhatsApp, TelegramBot).
        ['User-agent: *', `Content-Signal: ${CONTENT_SIGNAL}`, 'Allow: /'],
        group('AI crawlers, AI assistants and AI agents', AI_CRAWLERS),
        group('SEO, marketing and media-monitoring data harvesters', DATA_HARVESTERS),
      ];

  return [...sections, [sitemap]].map((lines) => lines.join('\n')).join('\n\n') + '\n';
}

/** Every user agent a robots.txt asks to stay away (case as written). */
export function disallowedAgents(robotsTxt: string): string[] {
  const agents: string[] = [];
  let pending: string[] = [];
  let groupHasRules = false;
  for (const raw of robotsTxt.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const key = field.trim().toLowerCase();
    if (key === 'user-agent') {
      // A user-agent line after rules starts a new group (RFC 9309 §2.1).
      if (groupHasRules) {
        pending = [];
        groupHasRules = false;
      }
      pending.push(value);
    } else {
      groupHasRules = true;
      if (key === 'disallow' && value === '/') agents.push(...pending);
    }
  }
  return agents;
}
