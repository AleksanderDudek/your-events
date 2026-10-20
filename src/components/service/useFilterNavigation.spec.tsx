import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withBasePath } from '@/lib/constants';

const push = vi.fn();
let currentQuery = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

vi.mock('@/config/CityProvider', () => ({
  useCity: () => ({ city: { id: 'wroclaw' } }),
}));

// The buffer that makes consecutive updates compose is module state, so each
// test needs a fresh copy of the module.
async function loadHook() {
  vi.resetModules();
  const mod = await import('./useFilterNavigation');
  return mod.useFilterNavigation;
}

/** Move the browser URL the way a landed navigation would. */
function settleUrl(query: string) {
  currentQuery = query;
  window.history.replaceState({}, '', query ? `/?${query}` : '/');
}

describe('useFilterNavigation', () => {
  beforeEach(() => {
    push.mockClear();
    settleUrl('');
  });

  // router.push writes the URL asynchronously; before this buffer existed, the
  // second toggle read the pre-push query string and dropped the first category.
  it('composes two updates fired in the same tick', async () => {
    const useFilterNavigation = await loadHook();
    const { result } = renderHook(() => useFilterNavigation());

    act(() => {
      result.current.updateFilters({ categories: ['muzyka'] });
      result.current.updateFilters({
        categories: [...result.current.readCurrentFilters().categories, 'film'],
      });
    });

    expect(window.location.search).toBe('?categories=muzyka%2Cfilm');
  });

  it('clears every filter but keeps the view preferences', async () => {
    const useFilterNavigation = await loadHook();
    settleUrl('search=jazz&categories=muzyka&dateMode=single&dateSingle=2026-07-23&viewMode=map&pageSize=30');
    const { result } = renderHook(() => useFilterNavigation());

    act(() => result.current.clearFilters());

    expect(window.location.pathname).toBe(withBasePath('/wroclaw/wydarzenia/'));
    expect(window.location.search).toBe('?pageSize=30&viewMode=map');
  });

  // The exported build's router dedupes ANY same-route push against the URL the
  // page was cold-loaded with: it replaces the requested query with the loaded
  // one, which flipped the view back and pinned the list on page 1. Every
  // navigation therefore writes history itself — never router.push.
  it('never routes through router.push, even for a filtered URL', async () => {
    const useFilterNavigation = await loadHook();
    settleUrl('viewMode=row');
    const { result } = renderHook(() => useFilterNavigation());

    act(() => result.current.updatePagination({ page: 2 }));

    expect(push).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(withBasePath('/wroclaw/wydarzenia/'));
    expect(window.location.search).toBe('?page=2&viewMode=row');
  });

  // The router drops a push back to the query-less URL when the page was loaded
  // cold at a filtered permalink, so a full reset writes history itself.
  it('resets to a clean URL even when the router would dedupe the push', async () => {
    const useFilterNavigation = await loadHook();
    settleUrl('categories=muzyka');
    const { result } = renderHook(() => useFilterNavigation());

    act(() => result.current.clearFilters());

    expect(push).not.toHaveBeenCalled();
    // history.pushState is not base-path-aware the way router.push is, so the
    // hook has to prefix it itself.
    expect(window.location.pathname).toBe(withBasePath('/wroclaw/wydarzenia/'));
    expect(window.location.search).toBe('');
  });

  it('hands control back to the URL once a push lands', async () => {
    const useFilterNavigation = await loadHook();
    const { result, rerender } = renderHook(() => useFilterNavigation());

    act(() => result.current.updateFilters({ categories: ['muzyka'] }));
    act(() => settleUrl('categories=muzyka'));
    rerender();

    expect(result.current.readCurrentFilters().categories).toEqual(['muzyka']);
  });

  it('drops buffered intent when something else navigates (back/forward)', async () => {
    const useFilterNavigation = await loadHook();
    const { result, rerender } = renderHook(() => useFilterNavigation());

    act(() => result.current.updateFilters({ categories: ['muzyka'] }));
    act(() => settleUrl('search=jazz'));
    rerender();

    const filters = result.current.readCurrentFilters();
    expect(filters.categories).toEqual([]);
    expect(filters.search).toBe('jazz');
  });
});
