import { describe, it, expect } from 'vitest';
import { metaDescriptors, type SeoContext } from './seo';

const ctx: SeoContext = {
  siteUrl: 'https://example.test/your-events',
  appName: 'Idź na miasto',
  defaultDescription: 'Domyślny opis.',
  noindex: false,
};

type Descriptor = Record<string, unknown>;

function find(list: Descriptor[], key: string, value: string): Descriptor | undefined {
  return list.find((d) => d[key] === value);
}

describe('metaDescriptors', () => {
  it('templates the page title with the brand', () => {
    const meta = metaDescriptors({ title: 'Wydarzenia w Wrocławiu' }, ctx);
    expect(meta[0]).toEqual({ title: 'Wydarzenia w Wrocławiu | Idź na miasto' });
  });

  it('uses the bare brand when a page has no title of its own', () => {
    expect(metaDescriptors({}, ctx)[0]).toEqual({ title: 'Idź na miasto' });
  });

  it('falls back to the default description', () => {
    const meta = metaDescriptors({}, ctx);
    expect(find(meta, 'name', 'description')).toEqual({ name: 'description', content: 'Domyślny opis.' });
  });

  // The canonical must be the URL the host actually serves — with the slash.
  it('builds an absolute, trailing-slash canonical from the page path', () => {
    const meta = metaDescriptors({ canonicalPath: '/wroclaw/wydarzenia' }, ctx);
    expect(find(meta, 'rel', 'canonical')).toEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://example.test/your-events/wroclaw/wydarzenia/',
    });
    expect(find(meta, 'property', 'og:url')).toEqual({
      property: 'og:url',
      content: 'https://example.test/your-events/wroclaw/wydarzenia/',
    });
  });

  it('emits no canonical when the page has none', () => {
    const meta = metaDescriptors({ title: 'x' }, ctx);
    expect(find(meta, 'rel', 'canonical')).toBeUndefined();
    expect(find(meta, 'property', 'og:url')).toBeUndefined();
  });

  it('gives social previews the untemplated title and the description', () => {
    const meta = metaDescriptors({ title: 'Jazz', description: 'Wieczór jazzowy', ogType: 'article' }, ctx);
    expect(find(meta, 'property', 'og:title')?.content).toBe('Jazz');
    expect(find(meta, 'property', 'og:description')?.content).toBe('Wieczór jazzowy');
    expect(find(meta, 'property', 'og:type')?.content).toBe('article');
    expect(find(meta, 'property', 'og:locale')?.content).toBe('pl_PL');
    expect(find(meta, 'property', 'og:site_name')?.content).toBe('Idź na miasto');
    expect(find(meta, 'name', 'twitter:card')?.content).toBe('summary');
    expect(find(meta, 'name', 'twitter:title')?.content).toBe('Jazz');
  });

  it('promotes the card to a large image when the page has one', () => {
    const meta = metaDescriptors({ title: 'Jazz', image: 'https://img.test/a.jpg' }, ctx);
    expect(find(meta, 'property', 'og:image')?.content).toBe('https://img.test/a.jpg');
    expect(find(meta, 'name', 'twitter:card')?.content).toBe('summary_large_image');
    expect(find(meta, 'name', 'twitter:image')?.content).toBe('https://img.test/a.jpg');
  });

  it('defaults og:type to website', () => {
    expect(find(metaDescriptors({}, ctx), 'property', 'og:type')?.content).toBe('website');
  });

  describe('robots', () => {
    it('emits nothing for an indexable page', () => {
      expect(find(metaDescriptors({}, ctx), 'name', 'robots')).toBeUndefined();
    });

    it('passes a page-level directive through', () => {
      const meta = metaDescriptors({ robots: 'noindex, follow' }, ctx);
      expect(find(meta, 'name', 'robots')?.content).toBe('noindex, follow');
    });

    // robots.txt stops the crawl; this stops the indexing. A disallowed page
    // can still be indexed from inbound links, so a dev site needs both — and
    // no page may opt back in.
    it('forces noindex, nofollow on a noindex environment, overriding the page', () => {
      const meta = metaDescriptors({ robots: 'noindex, follow' }, { ...ctx, noindex: true });
      expect(find(meta, 'name', 'robots')?.content).toBe('noindex, nofollow');
    });
  });
});
