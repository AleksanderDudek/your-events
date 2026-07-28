import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import PrivacyView from './PrivacyView';

describe('PrivacyView', () => {
  it('renders the title and every section heading', () => {
    render(<PrivacyView />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Polityka prywatności' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Co zbieramy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Cookies' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Kto przetwarza dane' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Wycofanie zgody' })
    ).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<PrivacyView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
