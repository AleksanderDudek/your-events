import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PRESETS_STORAGE_KEY } from '@/components/service/usePresets';
import { serializePresets } from '@/lib/presets';
import type { FilterPreset } from '@/types/preset.types';
import MyFiltersView from './MyFiltersView';

vi.mock('@/components/service/useCategories', () => ({
  useCategories: () => ({
    topLevel: [
      { slug: 'taniec', display_name: 'Taniec', color: '#ee4f86', parent_slug: null },
      { slug: 'muzyka', display_name: 'Muzyka', color: '#7c5ce0', parent_slug: null },
    ],
    byDisplayName: new Map([
      ['Taniec', { slug: 'taniec', display_name: 'Taniec', color: '#ee4f86' }],
    ]),
  }),
}));

function preset(overrides: Partial<FilterPreset> = {}): FilterPreset {
  return {
    id: 'p1',
    name: 'Taniec w weekend',
    cityId: 'wroclaw',
    filters: {
      search: '',
      categories: ['taniec'],
      dateWindow: 'weekend',
      dateFrom: null,
      dateTo: null,
      weekdays: [],
      hourFrom: null,
      hourTo: null,
      freeOnly: true,
      viewMode: 'grid',
      pageSize: 15,
    },
    createdAt: '2026-07-27T10:00:00.000Z',
    ...overrides,
  };
}

function seed(presets: FilterPreset[]): void {
  window.localStorage.setItem(PRESETS_STORAGE_KEY, serializePresets(presets));
}

describe('MyFiltersView', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('invites the user to create one when nothing is saved', () => {
    render(<MyFiltersView />);
    expect(screen.getByText('Nie masz jeszcze własnych filtrów')).toBeInTheDocument();
  });

  it('renders a saved preset as a tile pointing at its city and filters', () => {
    seed([preset()]);
    render(<MyFiltersView />);

    const link = screen.getByRole('link', { name: /Taniec w weekend/ });
    const href = link.getAttribute('href') ?? '';
    expect(href).toMatch(/^\/wroclaw\/wydarzenia\?/);
    expect(href).toContain('categories=taniec');
    expect(href).toContain('freeOnly=true');
    // The weekend window is resolved at render, not stored — so it carries dates.
    expect(href).toContain('dateFrom=');
  });

  it('summarises a preset so the tile says what it does', () => {
    seed([preset()]);
    render(<MyFiltersView />);
    // Category, then the resolved window, then the flags — one line, in order.
    expect(
      screen.getByText('Taniec · Najbliższy weekend · tylko bezpłatne')
    ).toBeInTheDocument();
  });

  it('says "all events" for a preset that filters nothing', () => {
    seed([
      preset({
        id: 'p2',
        name: 'Wszystko',
        filters: { ...preset().filters, categories: [], dateWindow: 'none', freeOnly: false },
      }),
    ]);
    render(<MyFiltersView />);
    expect(screen.getByText('Wszystkie wydarzenia')).toBeInTheDocument();
  });

  it('deletes a preset once the confirmation is accepted', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    seed([preset()]);
    render(<MyFiltersView />);

    await user.click(screen.getByRole('button', { name: 'Usuń' }));

    expect(screen.getByText('Nie masz jeszcze własnych filtrów')).toBeInTheDocument();
    expect(window.localStorage.getItem(PRESETS_STORAGE_KEY)).toBe('[]');
  });

  it('keeps the preset when the confirmation is declined', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    seed([preset()]);
    render(<MyFiltersView />);

    await user.click(screen.getByRole('button', { name: 'Usuń' }));

    expect(screen.getByText('Taniec w weekend')).toBeInTheDocument();
  });

  it('duplicates a preset next to the original', async () => {
    const user = userEvent.setup();
    seed([preset()]);
    render(<MyFiltersView />);

    await user.click(screen.getByRole('button', { name: 'Powiel' }));

    const tiles = screen.getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    expect(within(tiles[1]).getByText(/kopia/)).toBeInTheDocument();
  });

  it('creates a preset through the editor', async () => {
    const user = userEvent.setup();
    render(<MyFiltersView />);

    await user.click(screen.getByRole('button', { name: /Nowy filtr/ }));
    await user.type(screen.getByLabelText('Nazwa'), 'Wieczory taneczne');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(screen.getByText('Wieczory taneczne')).toBeInTheDocument();
  });

  it('refuses to save a preset with no name', async () => {
    const user = userEvent.setup();
    render(<MyFiltersView />);

    await user.click(screen.getByRole('button', { name: /Nowy filtr/ }));
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    // Still in the dialog, with the reason stated.
    expect(screen.getByText('Podaj nazwę')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    seed([preset()]);
    const { container } = render(<MyFiltersView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
