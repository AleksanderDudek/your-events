import { describe, it, expect } from 'vitest';
import { withTrailingSlash } from './href';

// GitHub Pages serves every page as <path>/index.html and answers the
// slash-less form with a 301. Internal links and canonicals carry the slash so
// neither visitors nor crawlers pay for that hop.
describe('withTrailingSlash', () => {
  it('appends a slash to a bare path', () => {
    expect(withTrailingSlash('/wroclaw/wydarzenia')).toBe('/wroclaw/wydarzenia/');
  });

  it('leaves a path that already ends in a slash alone', () => {
    expect(withTrailingSlash('/wroclaw/')).toBe('/wroclaw/');
    expect(withTrailingSlash('/')).toBe('/');
  });

  it('puts the slash before the query string and the hash', () => {
    expect(withTrailingSlash('/wroclaw/wydarzenia?page=2')).toBe('/wroclaw/wydarzenia/?page=2');
    expect(withTrailingSlash('/prywatnosc#cookies')).toBe('/prywatnosc/#cookies');
    expect(withTrailingSlash('/a?x=1#y')).toBe('/a/?x=1#y');
    expect(withTrailingSlash('/a/?x=1')).toBe('/a/?x=1');
  });

  it('does not touch file paths, absolute URLs or bare fragments', () => {
    expect(withTrailingSlash('/sitemap.xml')).toBe('/sitemap.xml');
    expect(withTrailingSlash('https://example.test/a')).toBe('https://example.test/a');
    expect(withTrailingSlash('mailto:hi@example.test')).toBe('mailto:hi@example.test');
    expect(withTrailingSlash('#main-content')).toBe('#main-content');
  });
});
