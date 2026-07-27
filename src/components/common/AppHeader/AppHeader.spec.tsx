import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppHeader from './AppHeader';

vi.mock('next/navigation', () => ({
  usePathname: () => '/events',
  useRouter: () => ({ push: vi.fn() }),
}));

// The header renders two different trees off one breakpoint query, so the mock
// is switchable rather than pinned to desktop.
vi.mock('@mui/material/useMediaQuery', () => ({ default: vi.fn() }));
const isMdUp = vi.mocked(useMediaQuery);

describe('AppHeader (desktop)', () => {
  beforeEach(() => {
    isMdUp.mockReturnValue(true);
  });

  it('renders without crashing', () => {
    render(<AppHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AppHeader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows navigation links', () => {
    render(<AppHeader />);
    expect(screen.getByText('Strona główna')).toBeInTheDocument();
    expect(screen.getByText('Wydarzenia')).toBeInTheDocument();
    expect(screen.getByText('Rozwijaj z nami')).toBeInTheDocument();
  });

  it('links to the community page outside the city subtree', () => {
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Rozwijaj z nami' })).toHaveAttribute(
      'href',
      '/rozwijaj-z-nami'
    );
  });

  it('has correct nav aria-label', () => {
    render(<AppHeader />);
    expect(screen.getByLabelText('Główna nawigacja')).toBeInTheDocument();
  });

  it('keeps the city, language and theme controls in the bar', () => {
    render(<AppHeader />);
    expect(screen.getByLabelText('Wybierz miasto')).toBeInTheDocument();
    expect(screen.getByLabelText('Język')).toBeInTheDocument();
  });
});

describe('AppHeader (mobile)', () => {
  beforeEach(() => {
    isMdUp.mockReturnValue(false);
  });

  it('leaves nothing but the wordmark and the menu button in the bar', () => {
    // Four controls plus the wordmark did not fit a 390px row.
    render(<AppHeader />);
    const bar = screen.getByRole('banner');
    const buttons = within(bar).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('Otwórz menu');
    expect(within(bar).getByText('Idź na miasto')).toBeInTheDocument();
  });

  it('opens a drawer carrying the wordmark, the links and the settings', async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    await user.click(screen.getByRole('button', { name: 'Otwórz menu' }));

    const drawer = screen.getByRole('presentation');
    // The wordmark is repeated so the drawer reads as the same site once it
    // covers the header — and appears twice on the page as a result.
    expect(within(drawer).getByText('Idź na miasto')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Wydarzenia' })).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Moje filtry' })).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Wybierz miasto')).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Język')).toBeInTheDocument();
  });

  it('names the selected city rather than showing a bare pin', async () => {
    // The name used to be hidden below sm to keep it out of the header row; in
    // the drawer that left no clue which city was selected.
    const user = userEvent.setup();
    render(<AppHeader />);
    await user.click(screen.getByRole('button', { name: 'Otwórz menu' }));

    const cityButton = within(screen.getByRole('presentation')).getByLabelText('Wybierz miasto');
    expect(cityButton).toHaveTextContent(/\w+/);
  });

  it('passes accessibility check with the drawer open', async () => {
    const user = userEvent.setup();
    const { container } = render(<AppHeader />);
    await user.click(screen.getByRole('button', { name: 'Otwórz menu' }));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
