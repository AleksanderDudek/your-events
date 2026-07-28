import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CookieBanner from './CookieBanner';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { resetConsentStoreForTests } from '@/components/service/useConsent';
import { LocaleProvider } from '@/i18n';

function renderBanner() {
  return render(
    <LocaleProvider>
      <CookieBanner />
    </LocaleProvider>
  );
}

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConsentStoreForTests();
    (window as unknown as { clarity?: unknown }).clarity = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as { clarity?: unknown }).clarity;
  });

  it('asks when no choice is stored', () => {
    renderBanner();
    expect(screen.getByRole('region', { name: 'Zgoda na cookies' })).toBeInTheDocument();
  });

  it('grants analytics storage on accept and remembers it', async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: 'Akceptuję' }));

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('accepted');
    expect(window.clarity).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    });
    expect(screen.queryByRole('region', { name: 'Zgoda na cookies' })).not.toBeInTheDocument();
  });

  it('denies analytics storage on reject and remembers it', async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: 'Odrzucam' }));

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('rejected');
    expect(window.clarity).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'denied',
    });
    expect(screen.queryByRole('region', { name: 'Zgoda na cookies' })).not.toBeInTheDocument();
  });

  it('re-signals a stored choice on mount so a returning visitor keeps cookies', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    renderBanner();

    expect(window.clarity).toHaveBeenCalledWith('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    });
    expect(screen.queryByRole('region', { name: 'Zgoda na cookies' })).not.toBeInTheDocument();
  });

  it('does not throw when Clarity is gated off', async () => {
    delete (window as unknown as { clarity?: unknown }).clarity;
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: 'Akceptuję' }));

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('accepted');
  });
});
