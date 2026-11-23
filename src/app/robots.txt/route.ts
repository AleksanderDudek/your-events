import { IS_NOINDEX, SITE_URL } from '@/config/site';
import { buildRobotsTxt } from '@/lib/robotsTxt';

// Rendered once at build time into out/robots.txt (static export).
export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(buildRobotsTxt({ siteUrl: SITE_URL, noindex: IS_NOINDEX }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
