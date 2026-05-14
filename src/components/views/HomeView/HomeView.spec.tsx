import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

import HomeView from './HomeView';

describe('HomeView', () => {
  it('renders the headline prompt and tagline', () => {
    render(<HomeView />);
    expect(screen.getByText('Chcesz zrobić coś fajnego?')).toBeInTheDocument();
    expect(screen.getByText('Idź na miasto')).toBeInTheDocument();
  });

  it('renders all three CTA tiles', () => {
    render(<HomeView />);
    expect(screen.getByText('Co się dzieje teraz na mieście?')).toBeInTheDocument();
    expect(screen.getByText('Co się dzieje w ten weekend?')).toBeInTheDocument();
    expect(screen.getByText('Gdzie mogę dzisiaj poćwiczyć?')).toBeInTheDocument();
  });

  it('has the browse-all secondary link', () => {
    render(<HomeView />);
    expect(screen.getByText('Przeglądaj wszystkie wydarzenia')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<HomeView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
