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

  it('states the cookie names, their lifetimes, and that they are set only after consent', () => {
    render(<PrivacyView />);
    expect(screen.getByText(/_clck.*ważny przez rok/)).toBeInTheDocument();
    expect(screen.getByText(/_clsk.*ważny przez dobę/)).toBeInTheDocument();
    expect(screen.getByText(/ustawiane są dopiero po Twojej zgodzie/)).toBeInTheDocument();
  });

  it('states that rejecting consent makes Clarity delete its cookies', () => {
    render(<PrivacyView />);
    expect(
      screen.getByText(/Po odrzuceniu Clarity usuwa swoje cookies i przestaje je zapisywać/)
    ).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<PrivacyView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
