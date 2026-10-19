import { messages, DEFAULT_LOCALE } from '@/i18n';
import { DEFAULT_CITY_ID, getCity } from '@/config/cities';
import { IS_NOINDEX, SITE_URL } from '@/config/site';
import { withTrailingSlash } from './href';

// The <head> tags every page ships, built here so a route only says what is
// specific to it. React Router's `meta` export REPLACES its ancestors' tags
// rather than merging with them, so the shared parts cannot live in root.tsx —
// each route returns buildMeta(...) and gets the defaults back.
//
// Like the rest of the export, the tags are rendered at build time in
// DEFAULT_LOCALE (pl): locale and city switching happen in the browser.

export interface PageSeo {
  /** Page title without the brand; the template adds " | APP_NAME". */
  title?: string;
  description?: string;
  /** Site-relative path; becomes the absolute, trailing-slash canonical. */
  canonicalPath?: string;
  ogType?: 'website' | 'article';
  image?: string;
  /** Page-level robots directive, e.g. 'noindex, follow'. */
  robots?: string;
}

export interface SeoContext {
  siteUrl: string;
  appName: string;
  defaultDescription: string;
  /** A noindex environment (the dev site) overrides every page. */
  noindex: boolean;
}

// Structurally what React Router's MetaDescriptor allows, without tying this
// module (and its tests) to the router.
export type MetaDescriptor =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { tagName: 'link'; rel: string; href: string };

export function metaDescriptors(page: PageSeo, ctx: SeoContext): MetaDescriptor[] {
  const title = page.title ?? ctx.appName;
  const description = page.description ?? ctx.defaultDescription;
  const canonical = page.canonicalPath ? `${ctx.siteUrl}${withTrailingSlash(page.canonicalPath)}` : undefined;
  const robots = ctx.noindex ? 'noindex, nofollow' : page.robots;

  const meta: MetaDescriptor[] = [
    { title: page.title ? `${page.title} | ${ctx.appName}` : ctx.appName },
    { name: 'description', content: description },
  ];
  if (robots) meta.push({ name: 'robots', content: robots });
  if (canonical) meta.push({ tagName: 'link', rel: 'canonical', href: canonical });

  meta.push(
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: page.ogType ?? 'website' },
    { property: 'og:locale', content: 'pl_PL' },
    { property: 'og:site_name', content: ctx.appName }
  );
  if (canonical) meta.push({ property: 'og:url', content: canonical });
  if (page.image) meta.push({ property: 'og:image', content: page.image });

  meta.push(
    { name: 'twitter:card', content: page.image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description }
  );
  if (page.image) meta.push({ name: 'twitter:image', content: page.image });

  return meta;
}

const m = messages[DEFAULT_LOCALE];

/** metaDescriptors() bound to this deployment's site URL, brand and robots policy. */
export function buildMeta(page: PageSeo = {}): MetaDescriptor[] {
  return metaDescriptors(page, {
    siteUrl: SITE_URL,
    appName: m.APP_NAME,
    defaultDescription: m.META_DESCRIPTION(getCity(DEFAULT_CITY_ID).locativeForm[DEFAULT_LOCALE]),
    noindex: IS_NOINDEX,
  });
}
