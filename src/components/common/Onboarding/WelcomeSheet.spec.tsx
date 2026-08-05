import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { LocaleProvider } from '@/i18n';
import WelcomeSheet from './WelcomeSheet';

function renderSheet(overrides: Partial<{ onSkip: () => void; onStart: () => void }> = {}) {
  const onSkip = overrides.onSkip ?? vi.fn();
  const onStart = overrides.onStart ?? vi.fn();
  const result = render(
    <LocaleProvider>
      <WelcomeSheet cityLocative="Szczecinie" onSkip={onSkip} onStart={onStart} />
    </LocaleProvider>
  );
  return { ...result, onSkip, onStart };
}

describe('WelcomeSheet', () => {
  it('introduces the site and names the current city', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Witaj w Idź na miasto' })).toBeInTheDocument();
    expect(screen.getByText(/Szczecinie/)).toBeInTheDocument();
  });

  it('lists what the site can do', () => {
    renderSheet();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('passes accessibility check', async () => {
    const { baseElement } = renderSheet();
    // The dialog renders through a portal, so the assertion has to look at the
    // whole document rather than the render container.
    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();
  });

  it('starts the tour on "Pokaż mi"', async () => {
    const user = userEvent.setup();
    const { onStart } = renderSheet();
    await user.click(screen.getByRole('button', { name: 'Pokaż mi' }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('dismisses on "Pomiń"', async () => {
    const user = userEvent.setup();
    const { onSkip } = renderSheet();
    await user.click(screen.getByRole('button', { name: 'Pomiń' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  // Esc has to count as a dismissal, not as "ask me again on the next page" —
  // otherwise pressing it turns the sheet into a nag.
  it('treats Escape as a dismissal', async () => {
    const user = userEvent.setup();
    const { onSkip } = renderSheet();
    await user.keyboard('{Escape}');
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
