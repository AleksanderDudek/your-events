import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PRESETS_STORAGE_KEY } from '@/components/service/usePresets';
import { serializePresets } from '@/lib/presets';
import type { FilterPreset } from '@/types/preset.types';
import MyFiltersView from './MyFiltersView';

import type { PushReminder } from '@/components/service/usePushReminder';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const reminderState: { current: PushReminder } = {
  current: {
    available: false,
    support: 'checking',
    enabled: false,
    markedId: null,
    busy: false,
    enable: vi.fn(),
    disable: vi.fn(),
    toggleMark: vi.fn(),
  },
};
vi.mock('@/components/service/usePushReminder', () => ({ usePushReminder: () => reminderState.current }));

// Season names come from the city's seasons table; outside a season, from the slug.
vi.mock('@/components/service/useSeasons', () => ({
  useSeasonName: () => (slug: string) => (slug === 'swieta' ? 'Święta' : slug),
}));

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
      near: null,
      season: null,
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

  it('names the point and the radius of a nearby preset', () => {
    seed([
      preset({
        filters: { ...preset().filters, near: { lat: 51.11, lng: 17.032, radius: 1500, label: 'Rynek' } },
      }),
    ]);
    render(<MyFiltersView />);
    expect(screen.getByText(/W promieniu 1,5\skm: Rynek$/)).toBeInTheDocument();
  });

  // A saved point is fixed; it is never "your location", which may have moved.
  it('calls an unnamed saved point "selected point"', () => {
    seed([
      preset({
        filters: { ...preset().filters, near: { lat: 51.11, lng: 17.032, radius: 1000, label: null } },
      }),
    ]);
    render(<MyFiltersView />);
    expect(screen.getByText(/W promieniu 1\skm: Wybrany punkt$/)).toBeInTheDocument();
  });

  it('names the season a preset keeps', () => {
    seed([preset({ filters: { ...preset().filters, season: 'swieta' } })]);
    render(<MyFiltersView />);
    expect(screen.getByText(/sezon: Święta/)).toBeInTheDocument();
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

describe('MyFiltersView push reminders', () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockReset();
    window.history.replaceState(null, '', '/moje-filtry/');
    reminderState.current = {
      available: true,
      support: 'ready',
      enabled: true,
      markedId: null,
      busy: false,
      enable: vi.fn(),
      disable: vi.fn(),
      toggleMark: vi.fn(async () => 'marked' as const),
    };
  });

  it('shows the reminder card, also with no filters saved', () => {
    render(<MyFiltersView />);
    expect(screen.getByRole('heading', { level: 2, name: 'Przypomnienia' })).toBeInTheDocument();
  });

  it('each tile has a bell that marks that filter', async () => {
    seed([preset()]);
    render(<MyFiltersView />);
    const bell = screen.getByRole('button', { name: 'Przypominaj o tym filtrze' });
    expect(bell).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(bell);
    expect(reminderState.current.toggleMark).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });

  it('the marked filter shows a pressed bell', () => {
    reminderState.current.markedId = 'p1';
    seed([preset()]);
    render(<MyFiltersView />);
    expect(screen.getByRole('button', { name: 'Przypominaj o tym filtrze' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('no bells when reminders are not available', () => {
    reminderState.current.available = false;
    seed([preset()]);
    render(<MyFiltersView />);
    expect(screen.queryByRole('button', { name: 'Przypominaj o tym filtrze' })).not.toBeInTheDocument();
  });

  it('?open=<id> goes straight to that filter', () => {
    seed([preset()]);
    window.history.replaceState(null, '', '/moje-filtry/?open=p1');
    render(<MyFiltersView />);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/wroclaw/wydarzenia'));
  });

  it('?open= with an unknown id stays on the list', () => {
    seed([preset()]);
    window.history.replaceState(null, '', '/moje-filtry/?open=gone');
    render(<MyFiltersView />);
    expect(replace).not.toHaveBeenCalled();
  });
});
