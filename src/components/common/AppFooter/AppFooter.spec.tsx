import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import AppFooter from './AppFooter';
import { resetConsentStoreForTests } from '@/components/service/useConsent';

describe('AppFooter', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConsentStoreForTests();
  });

  it('renders without crashing', () => {
    render(<AppFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AppFooter />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays copyright with current year', () => {
    render(<AppFooter />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} Idź na miasto`)).toBeInTheDocument();
  });

  it('renders a "Cookies" control that reopens the consent choice', async () => {
    const user = userEvent.setup();
    render(<AppFooter />);

    const control = screen.getByRole('button', { name: 'Cookies' });
    expect(control.tagName).toBe('BUTTON');

    await user.click(control);

    // AppFooter alone does not mount CookieBanner - the reopen flag is
    // asserted end-to-end via AppLayout.spec.tsx. Here we only pin that the
    // control is a real, clickable button that does not throw.
    expect(control).toBeInTheDocument();
  });
});
