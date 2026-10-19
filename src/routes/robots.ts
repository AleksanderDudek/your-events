import { IS_NOINDEX, SITE_URL } from '@/config/site';
import { robotsTxt } from '@/lib/robots';

// A resource route, rendered to out/robots.txt at build time.
export function loader() {
  return new Response(robotsTxt({ noindex: IS_NOINDEX, siteUrl: SITE_URL }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
