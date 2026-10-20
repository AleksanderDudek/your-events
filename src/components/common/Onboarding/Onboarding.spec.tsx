import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n';
import { CityProvider } from '@/config/CityProvider';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION } from '@/lib/onboarding';
import { PRESETS_STORAGE_KEY } from '@/components/service/usePresets';
import { resetConsentStoreForTests } from '@/components/service/useConsent';
import { resetOnboardingStoreForTests } from '@/components/service/useOnboarding';
import { getDefaultFilters } from '@/lib/filterUtils';
import { parsePresets } from '@/lib/presets';
import type { EventFilters } from '@/types/filter.types';
import Onboarding from './Onboarding';

const push = vi.fn();
const updateFilters = vi.fn();
let pathname = '/szczecin/wydarzenia/';
let currentFilters: EventFilters = getDefaultFilters();

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

// The story writes filters through this hook; capturing the calls is how the
// script's effects are asserted without a router or a URL.
vi.mock('@/components/service/useFilterNavigation', () => ({
  useFilterNavigation: () => ({
    filters: currentFilters,
    readCurrentFilters: () => currentFilters,
    updateFilters,
    updatePagination: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

vi.mock('@/components/service/useCategories', () => ({
  useCategories: () => ({
    bySlug: new Map([
      ['taniec', { slug: 'taniec' }],
      ['sport-i-fitness', { slug: 'sport-i-fitness' }],
      ['muzyka', { slug: 'muzyka' }],
    ]),
    byDisplayName: new Map(),
    displayNameToSlug: new Map(),
    topLevel: [],
    byParent: new Map(),
  }),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function renderOnboarding() {
  return render(
    <LocaleProvider>
      <CityProvider>
        {/* Stand-ins for the controls the story points at, on both surfaces. */}
        <button type="button" data-tour="filters" />
        <button type="button" data-tour="results" />
        <button type="button" data-tour="save" />
        <button type="button" data-tour="preset-tile" />
        <button type="button" data-tour="preset-edit" />
        <Onboarding />
      </CityProvider>
    </LocaleProvider>
  );
}

const sheetTitle = { name: 'Witaj w Idź na miasto' };
const storedPresets = () => parsePresets(localStorage.getItem(PRESETS_STORAGE_KEY));

/** Advance the story one step and wait for the next tooltip to settle. */
async function next(user: ReturnType<typeof userEvent.setup>, heading: string) {
  await user.click(screen.getByRole('button', { name: 'Dalej' }));
  await screen.findByRole('heading', { name: heading });
}

async function startStory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Pokaż mi' }));
  await screen.findByRole('heading', { name: 'Zacznijmy od przykładu' });
}

describe('Onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConsentStoreForTests();
    resetOnboardingStoreForTests();
    push.mockClear();
    updateFilters.mockClear();
    pathname = '/szczecin/wydarzenia/';
    currentFilters = getDefaultFilters();
    // The sheet reads the arrival query string straight off window.location.
    window.history.replaceState(null, '', '/szczecin/wydarzenia/');
    // A consent choice already on file — otherwise the cookie banner is open
    // and onboarding must stay closed.
    localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
  });

  describe('when it offers itself', () => {
    it('greets a first-time visitor on the events list', async () => {
      renderOnboarding();
      expect(await screen.findByRole('heading', sheetTitle)).toBeInTheDocument();
    });

    it('stays closed while the cookie banner is still unanswered', () => {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
      renderOnboarding();
      expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
    });

    it('stays closed for someone who has already seen it', () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, String(ONBOARDING_VERSION));
      renderOnboarding();
      expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
    });

    // Someone arriving on a shared filter link came for those results. The
    // story would overwrite them with dance classes on Thursdays.
    it('stays closed when the visitor arrived with filters already applied', () => {
      window.history.replaceState(null, '', '/szczecin/wydarzenia/?categories=muzyka');
      renderOnboarding();
      expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
    });

    it('stays off the city picker and off event pages', () => {
      pathname = '/';
      const { unmount } = renderOnboarding();
      expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
      unmount();

      pathname = '/szczecin/muzyka/jakis-koncert/';
      renderOnboarding();
      expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
    });

    it('records a dismissal so it does not ask again', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Pomiń' }));

      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(String(ONBOARDING_VERSION));
      expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
    });

    it('navigates to the events list before telling the story from the city home', async () => {
      const user = userEvent.setup();
      pathname = '/szczecin/';
      renderOnboarding();
      await user.click(await screen.findByRole('button', { name: 'Pokaż mi' }));

      expect(push).toHaveBeenCalledWith('/szczecin/wydarzenia');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('the story it tells', () => {
    it('builds the filter set one visible step at a time', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await startStory(user);

      expect(updateFilters).toHaveBeenCalledWith({
        categories: ['taniec', 'sport-i-fitness'],
      });

      await next(user, 'Tylko Twoje dni');
      expect(updateFilters).toHaveBeenCalledWith({ weekdays: [1, 2, 4] });

      await next(user, 'Po pracy, nie w jej trakcie');
      expect(updateFilters).toHaveBeenLastCalledWith(
        expect.objectContaining({
          dateMode: 'range',
          hourFrom: '16:00',
          hourTo: '21:00',
        })
      );
    });

    it('saves the set as a preset the visitor keeps', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await startStory(user);
      await next(user, 'Tylko Twoje dni');
      await next(user, 'Po pracy, nie w jej trakcie');
      await next(user, 'To jest Twój wieczór');
      await next(user, 'Zapisz, zamiast klikać to co tydzień');

      await waitFor(() => expect(storedPresets()).toHaveLength(1));
      const [preset] = storedPresets();
      expect(preset.name).toBe('Po pracy');
      expect(preset.cityId).toBe('szczecin');
      expect(preset.filters).toMatchObject({
        categories: ['taniec', 'sport-i-fitness'],
        weekdays: [1, 2, 4],
        hourFrom: '16:00',
        hourTo: '21:00',
        // Relative, so the preset does not rot into a link to last week.
        dateWindow: 'next7',
      });
    });

    it('walks to Moje filtry, opens the preset, edits it and opens it again', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await startStory(user);
      await next(user, 'Tylko Twoje dni');
      await next(user, 'Po pracy, nie w jej trakcie');
      await next(user, 'To jest Twój wieczór');
      await next(user, 'Zapisz, zamiast klikać to co tydzień');

      await next(user, 'Twoje filtry mieszkają tutaj');
      expect(push).toHaveBeenCalledWith('/moje-filtry');

      await next(user, 'Jedno kliknięcie i jesteś na miejscu');
      const opened = push.mock.calls.at(-1)?.[0] as string;
      expect(opened).toContain('/szczecin/wydarzenia?');
      expect(decodeURIComponent(opened)).toContain('16:00');

      // "You changed jobs" — the saved preset moves to the later hour, and we
      // are back on the page where the visitor would have made that edit.
      await next(user, 'Zmieniłeś pracę? Zmień filtr');
      await waitFor(() => expect(storedPresets()[0].filters.hourFrom).toBe('18:00'));
      expect(storedPresets()[0].filters.hourTo).toBe('21:00');
      expect(push).toHaveBeenLastCalledWith('/moje-filtry');
      // Still one preset — the edit replaced it rather than adding a second.
      expect(storedPresets()).toHaveLength(1);

      await next(user, 'I znowu jedno kliknięcie');
      const reopened = push.mock.calls.at(-1)?.[0] as string;
      expect(decodeURIComponent(reopened)).toContain('18:00');
    });

    it('marks the story seen once it is finished', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await startStory(user);
      await next(user, 'Tylko Twoje dni');
      await next(user, 'Po pracy, nie w jej trakcie');
      await next(user, 'To jest Twój wieczór');
      await next(user, 'Zapisz, zamiast klikać to co tydzień');
      await next(user, 'Twoje filtry mieszkają tutaj');
      await next(user, 'Jedno kliknięcie i jesteś na miejscu');
      await next(user, 'Zmieniłeś pracę? Zmień filtr');
      await next(user, 'I znowu jedno kliknięcie');

      await user.click(screen.getByRole('button', { name: 'Gotowe' }));

      await waitFor(() =>
        expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(String(ONBOARDING_VERSION))
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('leaves the preset behind when the visitor bails out mid-story', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await startStory(user);
      await next(user, 'Tylko Twoje dni');
      await user.keyboard('{Escape}');

      // Nothing was saved yet, and the story is over for good.
      expect(storedPresets()).toHaveLength(0);
      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(String(ONBOARDING_VERSION));
    });
  });
});
