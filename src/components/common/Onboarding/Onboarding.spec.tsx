import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n';
import { CityProvider } from '@/config/CityProvider';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION } from '@/lib/onboarding';
import { resetConsentStoreForTests } from '@/components/service/useConsent';
import { resetOnboardingStoreForTests } from '@/components/service/useOnboarding';
import Onboarding from './Onboarding';

const push = vi.fn();
let pathname = '/szczecin/wydarzenia/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function renderOnboarding() {
  // CityProvider, not a bare render: it derives the city from the (mocked)
  // pathname exactly as production does, which is what makes the "navigate to
  // this city's list" assertion meaningful rather than a test of the default.
  return render(
    <LocaleProvider>
      <CityProvider>
      {/* Stand-ins for the real controls, carrying the same tour anchors. */}
      <button type="button" data-tour="search">
        search
      </button>
      <button type="button" data-tour="sort">
        sort
      </button>
        <Onboarding />
      </CityProvider>
    </LocaleProvider>
  );
}

const sheetTitle = { name: 'Witaj w Idź na miasto' };

describe('Onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConsentStoreForTests();
    resetOnboardingStoreForTests();
    push.mockClear();
    pathname = '/szczecin/wydarzenia/';
    // A consent choice already on file — otherwise the cookie banner is open
    // and onboarding must stay closed.
    localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
  });

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

  it('stays off the city picker', () => {
    pathname = '/';
    renderOnboarding();
    expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
  });

  it('stays off an event detail page', () => {
    pathname = '/szczecin/muzyka/jakis-koncert/';
    renderOnboarding();
    expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
  });

  it('records the dismissal so it does not ask again', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Pomiń' }));

    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(String(ONBOARDING_VERSION));
    expect(screen.queryByRole('heading', sheetTitle)).not.toBeInTheDocument();
  });

  it('runs the tour in place when already on the events list', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Pokaż mi' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Krok 1 z 2')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  // From the city home there is nothing to point at, so "show me" is a
  // navigation first and a tour second.
  it('navigates to the events list before touring from the city home', async () => {
    const user = userEvent.setup();
    pathname = '/szczecin/';
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Pokaż mi' }));

    expect(push).toHaveBeenCalledWith('/szczecin/wydarzenia');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks the tour seen once it is finished', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(await screen.findByRole('button', { name: 'Pokaż mi' }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    await user.click(screen.getByRole('button', { name: 'Gotowe' }));

    await waitFor(() =>
      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(String(ONBOARDING_VERSION))
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
