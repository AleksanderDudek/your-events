import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

// env.ts (via @/config/site) resolves NEXT_PUBLIC_BASE_PATH / NEXT_PUBLIC_ROBOTS_NOINDEX
// at module load, so each case needs a fresh copy of the whole module graph.
async function loadLayout(overrides: { basePath?: string; noindex?: string } = {}) {
  vi.resetModules();
  if (overrides.basePath !== undefined) {
    process.env.NEXT_PUBLIC_BASE_PATH = overrides.basePath;
  } else {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  }
  if (overrides.noindex !== undefined) {
    process.env.NEXT_PUBLIC_ROBOTS_NOINDEX = overrides.noindex;
  } else {
    delete process.env.NEXT_PUBLIC_ROBOTS_NOINDEX;
  }
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
  it('is undefined when NEXT_PUBLIC_ROBOTS_NOINDEX is unset', async () => {
    const { metadata } = await loadLayout({ noindex: '' });
    expect(metadata.robots).toBeUndefined();
  });

  it('is { index: false, follow: false } when NEXT_PUBLIC_ROBOTS_NOINDEX is "true"', async () => {
    const { metadata } = await loadLayout({ noindex: 'true' });
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
