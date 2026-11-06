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

  it('explains what happens to a location and to a typed address', () => {
    render(<PrivacyView />);
    expect(screen.getByRole('heading', { level: 2, name: 'Lokalizacja' })).toBeInTheDocument();
    expect(screen.getByText(/zaokrągla ją do ok\. 100 m/)).toBeInTheDocument();
    expect(screen.getByText(/Komoot GmbH/)).toBeInTheDocument();
  });

  // The page must not claim more than the site does: the point stays in the
  // browser (the tab, or a saved filter), and pages with no city ask for a
  // location of their own to suggest one.
  it('owns up to where a location is kept, and to the city suggestion', () => {
    render(<PrivacyView />);
    expect(screen.getByText(/dzwonkiem, zostaje w Twojej przeglądarce/)).toBeInTheDocument();
    expect(screen.getByText(/podpowiedzieć najbliższe miasto/)).toBeInTheDocument();
  });

  it('explains what push reminders store, and that the marked filter stays on the phone', () => {
    render(<PrivacyView />);
    expect(screen.getByRole('heading', { level: 2, name: 'Przypomnienia' })).toBeInTheDocument();
    expect(screen.getByText(/strefę czasową i czas ostatniego przypomnienia/)).toBeInTheDocument();
    expect(screen.getByText(/dzwonkiem, zostaje w Twojej przeglądarce/)).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<PrivacyView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
