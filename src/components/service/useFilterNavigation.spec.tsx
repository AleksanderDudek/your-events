import { act, render, waitFor } from '@testing-library/react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withBasePath } from '@/lib/constants';

vi.mock('@/config/CityProvider', () => ({
  useCity: () => ({ city: { id: 'wroclaw' } }),
}));

type Hook = typeof import('./useFilterNavigation').useFilterNavigation;

// The buffer that makes consecutive updates compose is module state, so each
// test needs a fresh copy of the module.
async function loadHook(): Promise<Hook> {
  vi.resetModules();
  const mod = await import('./useFilterNavigation');
  return mod.useFilterNavigation;
}

/**
 * Runs the hook under a real browser data router — the kind the app hydrates
 * with — so navigate() commits asynchronously exactly as it does in the app,
 * and window.location is the URL the hook reads back.
 */
function renderFilterNavigation(useFilterNavigation: Hook) {
  const result = {} as { current: ReturnType<Hook> };
  function Probe() {
    result.current = useFilterNavigation();
    return null;
  }
  const router = createBrowserRouter([{ path: '*', element: <Probe /> }]);
  render(<RouterProvider router={router} />);
  return { result, router };
}

/** The URL the page was cold-loaded at. */
function loadAt(query: string) {
  window.history.replaceState(null, '', query ? `/wroclaw/wydarzenia/?${query}` : '/wroclaw/wydarzenia/');
}

describe('useFilterNavigation', () => {
  beforeEach(() => loadAt(''));

  // navigate() commits the URL asynchronously; before this buffer existed, the
  // second toggle read the pre-navigation query string and dropped the first
  // category.
  it('composes two updates fired in the same tick', async () => {
    const { result } = renderFilterNavigation(await loadHook());

    act(() => {
      result.current.updateFilters({ categories: ['muzyka'] });
      result.current.updateFilters({
        categories: [...result.current.readCurrentFilters().categories, 'film'],
      });
    });

    await waitFor(() => expect(window.location.search).toBe('?categories=muzyka%2Cfilm'));
  });

  it('clears every filter but keeps the view preferences', async () => {
    loadAt('search=jazz&categories=muzyka&dateMode=single&dateSingle=2026-07-23&viewMode=map&pageSize=30');
    const { result } = renderFilterNavigation(await loadHook());

    act(() => result.current.clearFilters());

    await waitFor(() => expect(window.location.search).toBe('?pageSize=30&viewMode=map'));
    expect(window.location.pathname).toBe(withBasePath('/wroclaw/wydarzenia/'));
  });

  // Guards the bug that shipped under the old Next export: from a page
  // cold-loaded with a query, paging snapped the URL back to the loaded query
  // and the list stayed on page 1. e2e-export/paging-and-view.spec.ts checks
  // the same thing against the real build.
  it('pages from a cold-loaded filtered URL without losing the query', async () => {
    loadAt('viewMode=row');
    const { result } = renderFilterNavigation(await loadHook());

    act(() => result.current.updatePagination({ page: 2 }));

    await waitFor(() => expect(window.location.search).toBe('?page=2&viewMode=row'));
    expect(window.location.pathname).toBe(withBasePath('/wroclaw/wydarzenia/'));
  });

  it('resets to a clean URL from a cold-loaded filtered permalink', async () => {
    loadAt('categories=muzyka');
    const { result } = renderFilterNavigation(await loadHook());

    act(() => result.current.clearFilters());

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.pathname).toBe(withBasePath('/wroclaw/wydarzenia/'));
  });

  it('hands control back to the URL once a navigation lands', async () => {
    const { result } = renderFilterNavigation(await loadHook());

    act(() => result.current.updateFilters({ categories: ['muzyka'] }));
    await waitFor(() => expect(window.location.search).toBe('?categories=muzyka'));

    expect(result.current.readCurrentFilters().categories).toEqual(['muzyka']);
    expect(result.current.filters.categories).toEqual(['muzyka']);
  });

  it('drops buffered intent when something else navigates (back/forward)', async () => {
    const { result, router } = renderFilterNavigation(await loadHook());

    act(() => result.current.updateFilters({ categories: ['muzyka'] }));
    // Someone else moves the URL before ours lands — a Link, a city switch.
    await act(() => router.navigate('/wroclaw/wydarzenia/?search=jazz'));

    await waitFor(() => expect(result.current.filters.search).toBe('jazz'));
    const filters = result.current.readCurrentFilters();
    expect(filters.categories).toEqual([]);
    expect(filters.search).toBe('jazz');
  });
});
