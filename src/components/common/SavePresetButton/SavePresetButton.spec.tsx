import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import SavePresetButton from './SavePresetButton';
import { PRESETS_STORAGE_KEY } from '@/components/service/usePresets';
import { getDefaultFilters } from '@/lib/filterUtils';
import { parsePresets } from '@/lib/presets';
import type { EventFilters } from '@/types/filter.types';

function storedPresets() {
  return parsePresets(window.localStorage.getItem(PRESETS_STORAGE_KEY));
}

async function saveAs(name: string, filters: Partial<EventFilters>, pick?: string) {
  const user = userEvent.setup();
  render(<SavePresetButton filters={{ ...getDefaultFilters(), ...filters }} cityId="wroclaw" />);
  await user.click(screen.getByRole('button', { name: 'Zapisz filtry' }));
  await user.type(screen.getByLabelText('Nazwa'), name);
  if (pick) {
    await user.click(screen.getByRole('combobox', { name: 'Kiedy' }));
    await user.click(screen.getByRole('option', { name: pick }));
  }
  await user.click(screen.getByRole('button', { name: 'Zapisz' }));
  return storedPresets()[0];
}

describe('SavePresetButton', () => {
  // A Monday. Only Date is faked, so userEvent's own timers still run.
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 27, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves "today" as today, not as the date it was saved on', async () => {
    const preset = await saveAs('Dziś po pracy', {
      dateMode: 'single',
      dateSingle: '2026-07-27',
      hourFrom: '17:00',
    });
    expect(preset.filters).toMatchObject({
      dateWindow: 'today',
      dateFrom: null,
      dateTo: null,
      hourFrom: '17:00',
    });
  });

  it('saves no date as "from today", which opens on the default window', async () => {
    const preset = await saveAs('Taniec', { categories: ['taniec'] });
    expect(preset.filters).toMatchObject({ dateWindow: 'none', dateFrom: null, dateTo: null });
  });

  it('keeps dates that match no window as those dates', async () => {
    const preset = await saveAs('Festiwal', {
      dateMode: 'range',
      dateFrom: '2026-08-14',
      dateTo: '2026-08-16',
    });
    expect(preset.filters).toMatchObject({
      dateWindow: 'fixed',
      dateFrom: '2026-08-14',
      dateTo: '2026-08-16',
    });
  });

  it('lets a matching window be kept as exact dates instead', async () => {
    const preset = await saveAs(
      'Ten jeden weekend',
      { dateMode: 'range', dateFrom: '2026-07-31', dateTo: '2026-08-02' },
      'Dokładnie te daty: 2026-07-31 – 2026-08-02'
    );
    expect(preset.filters).toMatchObject({
      dateWindow: 'fixed',
      dateFrom: '2026-07-31',
      dateTo: '2026-08-02',
    });
  });

  it('lets fixed dates be turned into "from today" instead', async () => {
    const preset = await saveAs(
      'Od dziś',
      { dateMode: 'single', dateSingle: '2026-08-15' },
      'Od dziś (najbliższe 3 miesiące)'
    );
    expect(preset.filters).toMatchObject({ dateWindow: 'none', dateFrom: null, dateTo: null });
  });

  it('offers exact dates only when there are dates to keep', async () => {
    const user = userEvent.setup();
    render(<SavePresetButton filters={getDefaultFilters()} cityId="wroclaw" />);
    await user.click(screen.getByRole('button', { name: 'Zapisz filtry' }));
    await user.click(screen.getByRole('combobox', { name: 'Kiedy' }));
    expect(screen.queryByRole('option', { name: /Dokładnie te daty/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dzisiaj' })).toBeInTheDocument();
  });
});

describe('SavePresetButton — dates it cannot keep as they are', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 27, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('names a half-open range by its one end, not as a single day', async () => {
    const user = userEvent.setup();
    render(
      <SavePresetButton
        filters={{ ...getDefaultFilters(), dateMode: 'range', dateFrom: '2026-08-14' }}
        cityId="wroclaw"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz filtry' }));
    expect(screen.getByRole('combobox', { name: 'Kiedy' })).toHaveTextContent(
      'Dokładnie te daty: od 2026-08-14'
    );
  });

  it('warns that hours need a date when "from today" would drop them', async () => {
    const user = userEvent.setup();
    render(
      <SavePresetButton
        filters={{ ...getDefaultFilters(), dateMode: 'single', dateSingle: '2026-08-15', hourFrom: '18:00' }}
        cityId="wroclaw"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz filtry' }));
    expect(screen.queryByText(/Godziny działają tylko/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Kiedy' }));
    await user.click(screen.getByRole('option', { name: 'Od dziś (najbliższe 3 miesiące)' }));
    expect(screen.getByText(/Godziny działają tylko/)).toBeInTheDocument();
  });
});
