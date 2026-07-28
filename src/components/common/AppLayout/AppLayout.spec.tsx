import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import AppLayout from './AppLayout';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { resetConsentStoreForTests } from '@/components/service/useConsent';

vi.mock('next/navigation', () => ({
  usePathname: () => '/events',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

describe('AppLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConsentStoreForTests();
  });

  it('renders without crashing', () => {
    render(<AppLayout><div>Test</div></AppLayout>);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AppLayout><div>Test content</div></AppLayout>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has skip-to-content link', () => {
    render(<AppLayout><div>Test</div></AppLayout>);
    expect(screen.getByText('Przejdź do treści')).toBeInTheDocument();
  });

  it('renders children in main', () => {
    render(<AppLayout><div>Child content</div></AppLayout>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('lets the footer reopen the cookie banner after a choice was made', async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    const user = userEvent.setup();
    render(<AppLayout><div>Test</div></AppLayout>);

    expect(screen.queryByRole('region', { name: 'Zgoda na cookies' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cookies' }));

    expect(screen.getByRole('region', { name: 'Zgoda na cookies' })).toBeInTheDocument();
  });
});
