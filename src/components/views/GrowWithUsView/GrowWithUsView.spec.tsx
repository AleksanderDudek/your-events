import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { DISCORD_INVITE_URL, FEEDBACK_FORM_URL } from '@/config/community';
import GrowWithUsView from './GrowWithUsView';

describe('GrowWithUsView', () => {
  it('renders the headline and the closing line', () => {
    render(<GrowWithUsView />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Rozwijaj z nami' })
    ).toBeInTheDocument();
    expect(screen.getByText('Otwierasz i wiesz.')).toBeInTheDocument();
  });

  it('lists the available cities inside the story copy', () => {
    render(<GrowWithUsView />);
    // The city list is data-driven (AVAILABLE_CITIES), so assert the sentence
    // shape rather than a specific set of cities.
    expect(screen.getByText(/^Idź na miasto to próba załatwienia tego jednym widokiem\./))
      .toBeInTheDocument();
  });

  it('links to Discord and to the feedback form, both in a new tab', () => {
    render(<GrowWithUsView />);

    const discord = screen.getByRole('link', { name: /Wejdź na serwer/ });
    expect(discord).toHaveAttribute('href', DISCORD_INVITE_URL);
    expect(discord).toHaveAttribute('target', '_blank');
    expect(discord).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const form = screen.getByRole('link', { name: /Wypełnij ankietę/ });
    expect(form).toHaveAttribute('href', FEEDBACK_FORM_URL);
    expect(form).toHaveAttribute('target', '_blank');
    expect(form).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('passes accessibility check', async () => {
    const { container } = render(<GrowWithUsView />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
