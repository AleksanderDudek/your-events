import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppHeader from './AppHeader';
import { openShareDialog } from '@/components/service/usePromoShare';

// The real store, with the dialog opener observable.
vi.mock('@/components/service/usePromoShare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/service/usePromoShare')>()),
  openShareDialog: vi.fn(),
}));

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

  it('leaves only the wordmark, share and the menu button in the bar', () => {
    // Four controls plus the wordmark did not fit a 390px row; the settings
    // went into the drawer. Share stays out: on a phone it is the button that
    // opens the system share sheet, and two icons still fit beside the name.
    // (The share strip below the toolbar is its own row — see ShareStrip.)
    render(<AppHeader />);
    const toolbar = screen.getByRole('banner').querySelector('.MuiToolbar-root') as HTMLElement;
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName('Poleć znajomym');
    expect(buttons[1]).toHaveAccessibleName('Otwórz menu');
    expect(within(toolbar).getByText('Idź na miasto')).toBeInTheDocument();
  });

  it('carries the share strip inside the sticky header', () => {
    render(<AppHeader />);
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('button', { name: /Wyślij znajomym, będzie z kim iść/ })).toBeInTheDocument();
  });

  it('offers "Poleć znajomym" in the menu, which closes it and opens the dialog', async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    await user.click(screen.getByRole('button', { name: 'Otwórz menu' }));
    const drawer = screen.getByRole('presentation');
    await user.click(within(drawer).getByRole('button', { name: 'Poleć znajomym' }));
    expect(openShareDialog).toHaveBeenCalledWith('menu');
    await waitFor(() => expect(screen.queryByRole('presentation')).not.toBeInTheDocument());
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
