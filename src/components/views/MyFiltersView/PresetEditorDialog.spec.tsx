import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LocaleProvider } from '@/i18n';
import { emptyPresetFilters } from '@/lib/presets';
import type { FilterPreset } from '@/types/preset.types';
import PresetEditorDialog from './PresetEditorDialog';

// The dialog is taller than the viewport, so Save sits well below the name
// field. Before this, pressing Save with an empty name changed nothing the user
// could see from down there — the only feedback was an error message scrolled
// off the top. These tests pin the two things that fixed it.

// Season names come from the city's seasons table; outside a season, from the slug.
vi.mock('@/components/service/useSeasons', () => ({
  useSeasonName: () => (slug: string) => (slug === 'swieta' ? 'Święta' : slug),
}));

vi.mock('@/components/service/useCategories', () => ({
  useCategories: () => ({
    topLevel: [{ slug: 'taniec', display_name: 'Taniec', color: '#ee4f86', parent_slug: null }],
    byDisplayName: new Map(),
  }),
}));

// Two live cities, so a preset can move from one to the other.
vi.mock('@/config/cities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/cities')>();
  return {
    ...actual,
    AVAILABLE_CITIES: actual.CITIES.filter((city) => ['wroclaw', 'szczecin'].includes(city.id)),
  };
});

function blankDraft(): FilterPreset {
  return {
    id: 'new',
    name: '',
    cityId: 'szczecin',
    createdAt: '2026-07-28T00:00:00.000Z',
    filters: emptyPresetFilters(),
  };
}

function renderDialog(onSave = vi.fn()) {
  render(
    <LocaleProvider>
      <PresetEditorDialog open draft={blankDraft()} onSave={onSave} onCancel={vi.fn()} />
    </LocaleProvider>
  );
  return { onSave };
}

describe('PresetEditorDialog required-field feedback', () => {
  it('does not save and lists what is missing next to the button', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave).not.toHaveBeenCalled();
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('Uzupełnij, żeby zapisać:');
    // The field is named, not just "something is wrong".
    expect(summary).toHaveTextContent('Nazwa');
  });

  it('moves focus to the missing field so the user lands on it', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Move focus away from the autofocused name field first, otherwise the
    // assertion would pass without the fix doing anything.
    const city = screen.getByRole('combobox', { name: 'Miasto' });
    city.focus();
    expect(city).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(screen.getByRole('textbox', { name: 'Nazwa' })).toHaveFocus();
  });

  it('clears the summary once the field is filled in', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Nazwa' }), 'Weekend');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('saves once the required field has a value', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.type(screen.getByRole('textbox', { name: 'Nazwa' }), '  Weekend  ');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Weekend' });
  });
});

describe('PresetEditorDialog and a saved point', () => {
  const near = { lat: 51.11, lng: 17.032, radius: 1500, label: 'Rynek' };

  function renderWithPoint() {
    const onSave = vi.fn();
    render(
      <LocaleProvider>
        <PresetEditorDialog
          open
          draft={{
            ...blankDraft(),
            name: 'Blisko Rynku',
            cityId: 'wroclaw',
            filters: { ...emptyPresetFilters(), near },
          }}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      </LocaleProvider>
    );
    return { onSave };
  }

  it('shows the point and keeps it on save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWithPoint();

    expect(screen.getByText(/W promieniu 1,5\skm: Rynek/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave.mock.calls[0][0].filters.near).toEqual(near);
  });

  it('can drop the point', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWithPoint();

    // A deletable chip is a button that Delete removes.
    screen.getByRole('button', { name: /W promieniu 1,5\skm: Rynek/ }).focus();
    await user.keyboard('{Delete}');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave.mock.calls[0][0].filters.near).toBeNull();
  });

  // A point is a place in one city; carried to another it would ask for
  // events nowhere near it.
  it('drops the point when the preset moves to another city', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWithPoint();

    await user.click(screen.getByRole('combobox', { name: 'Miasto' }));
    await user.click(screen.getByRole('option', { name: 'Szczecin' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave.mock.calls[0][0]).toMatchObject({ cityId: 'szczecin' });
    expect(onSave.mock.calls[0][0].filters.near).toBeNull();
  });
});
