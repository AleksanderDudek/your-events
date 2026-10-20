import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

// The two collaborators layout.tsx reads its configuration from are stubbed
// rather than driven through process.env.
//
// This started as env mutation and was flaky: process.env is one object shared
// by every spec file in the worker, and site.spec/robots.spec/manifest.spec all
// write the same two variables. A concurrent file could clear NOINDEX between
// this file setting it and the dynamic import reading it, so the suite failed
// roughly one run in two — while the file passed in isolation every time.
// Stubbing the modules makes each case hermetic. What is under test here is
// that layout.tsx *consults* those modules, which is exactly what this pins;
// that they read env correctly is site.spec's and constants' own business.
async function loadLayout(overrides: { basePath?: string; noindex?: boolean } = {}) {
  const basePath = overrides.basePath ?? '';
  vi.resetModules();
  vi.doMock('@/config/site', () => ({
    SITE_URL: `https://example.test${basePath}`,
    IS_NOINDEX: overrides.noindex ?? false,
  }));
  vi.doMock('@/lib/constants', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/constants')>();
    return {
      ...actual,
      BASE_PATH: basePath,
      withBasePath: (path: string) =>
        path.startsWith('/') ? `${basePath}${path}` : `${basePath}/${path}`,
    };
  });
  // The two heavy children are stubbed purely for speed. Re-importing the real
  // ones four times pulls MUI, react-query and the whole component tree through
  // the transform pipeline on every case, which took this file past the 5s
  // timeout once the rest of the suite was competing for the same workers.
  // Nothing here asserts on their output — only on <head> and the metadata.
  vi.doMock('./providers', () => ({
    default: ({ children }: { children: ReactNode }) => children,
  }));
  vi.doMock('@/components/common/AppLayout/AppLayout', () => ({
    default: ({ children }: { children: ReactNode }) => children,
  }));
  return import('./layout');
}

// The only props we ever read off a node in this tree.
interface ElementProps {
  children?: ReactNode;
  href?: string;
}
type Element = ReactElement<ElementProps>;

function isReactElement(node: ReactNode): node is Element {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node;
}

function asElementArray(children: ReactNode): Element[] {
  const list = Array.isArray(children) ? children : [children];
  return list.filter(isReactElement);
}

// RootLayout returns <html><head>...</head><body>...</body></html>, which RTL
// won't render cleanly into a jsdom document. Since we only need the props of
// the <head> children (not anything a browser/DOM would compute), we walk the
// plain React element tree that RootLayout({ children: null }) returns instead
// of rendering it.
function findHead(node: ReactNode): Element | undefined {
  if (!isReactElement(node)) return undefined;
  if (node.type === 'head') return node;
  for (const child of asElementArray(node.props.children)) {
    const found = findHead(child);
    if (found) return found;
  }
  return undefined;
}

function collectHeadHrefs(root: Element): string[] {
  const head = findHead(root);
  if (!head) throw new Error('RootLayout tree has no <head> element');
  return asElementArray(head.props.children)
    .map((child) => child.props.href)
    .filter((href): href is string => typeof href === 'string');
}

describe('RootLayout metadata.robots', () => {
  it('is undefined when the environment is indexable', async () => {
    const { metadata } = await loadLayout({ noindex: false });
    expect(metadata.robots).toBeUndefined();
  });

  it('is { index: false, follow: false } when the environment is noindex', async () => {
    const { metadata } = await loadLayout({ noindex: true });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('RootLayout head links', () => {
  it('prefixes every favicon/manifest href with the configured base path', async () => {
    const { default: RootLayout } = await loadLayout({ basePath: '/your-events-prod' });
    const root = RootLayout({ children: null }) as Element;
    const faviconHrefs = collectHeadHrefs(root).filter((href) => href.includes('/favicons/'));

    expect(faviconHrefs).toHaveLength(5);
    for (const href of faviconHrefs) {
      expect(href.startsWith('/your-events-prod/favicons/')).toBe(true);
    }
  });

  // Served from a domain root there is no prefix at all, and a leftover one
  // would 404 every favicon/manifest request.
  it('uses root-relative favicon/manifest hrefs when there is no base path', async () => {
    const { default: RootLayout } = await loadLayout({ basePath: '' });
    const root = RootLayout({ children: null }) as Element;
    const faviconHrefs = collectHeadHrefs(root).filter((href) => href.includes('/favicons/'));

    expect(faviconHrefs).toHaveLength(5);
    for (const href of faviconHrefs) {
      expect(href.startsWith('/favicons/')).toBe(true);
    }
  });
});
