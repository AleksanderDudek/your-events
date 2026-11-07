import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { LocaleProvider } from '@/i18n';
import WelcomeSheet, { type OnboardingReminder } from './WelcomeSheet';

function renderSheet(
  overrides: Partial<{ onSkip: () => void; onStart: () => void; reminder: OnboardingReminder }> = {}
) {
  const onSkip = overrides.onSkip ?? vi.fn();
  const onStart = overrides.onStart ?? vi.fn();
  const result = render(
    <LocaleProvider>
      <WelcomeSheet
        cityLocative="Szczecinie"
        onSkip={onSkip}
        onStart={onStart}
        reminder={overrides.reminder}
      />
    </LocaleProvider>
  );
  return { ...result, onSkip, onStart };
}

function reminder(overrides: Partial<OnboardingReminder> = {}): OnboardingReminder {
  return {
    available: true,
    support: 'ready',
    enabled: false,
    enable: vi.fn().mockResolvedValue('enabled'),
    ...overrides,
  };
}

const OPT_IN = 'Przypominaj mi o nowych wydarzeniach';

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

  describe('reminder opt-in', () => {
    it('is ticked by default where the browser can take reminders', () => {
      renderSheet({ reminder: reminder() });
      expect(screen.getByRole('checkbox', { name: OPT_IN })).toBeChecked();
    });

    // Both buttons are clicks, which is the only moment a browser lets a page
    // ask for notifications. So both ask, as long as the box stays ticked.
    it('asks for reminders and starts the tour on "Pokaż mi"', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onStart } = renderSheet({ reminder: r });
      await user.click(screen.getByRole('button', { name: 'Pokaż mi' }));
      expect(r.enable).toHaveBeenCalledOnce();
      expect(onStart).toHaveBeenCalledOnce();
    });

    it('asks for reminders and closes on "Pomiń"', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onSkip } = renderSheet({ reminder: r });
      await user.click(screen.getByRole('button', { name: 'Pomiń' }));
      expect(r.enable).toHaveBeenCalledOnce();
      expect(onSkip).toHaveBeenCalledOnce();
    });

    it('does not ask once the box is unticked', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onStart } = renderSheet({ reminder: r });
      await user.click(screen.getByRole('checkbox', { name: OPT_IN }));
      await user.click(screen.getByRole('button', { name: 'Pokaż mi' }));
      expect(r.enable).not.toHaveBeenCalled();
      expect(onStart).toHaveBeenCalledOnce();
    });

    // Escape and the backdrop mean "not now"; a permission prompt on top of
    // a dismissal would be the opposite of what the visitor asked for.
    it('does not ask when the sheet is dismissed with Escape', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onSkip } = renderSheet({ reminder: r });
      await user.keyboard('{Escape}');
      expect(onSkip).toHaveBeenCalledOnce();
      expect(r.enable).not.toHaveBeenCalled();
    });

    it.each([
      ['the feature is off', { available: false }],
      ['reminders are already on', { enabled: true }],
      ['support is still being checked', { support: 'checking' as const }],
      ['the browser blocked notifications', { support: 'blocked' as const }],
      ['the browser cannot do push', { support: 'unsupported' as const }],
    ])('is not offered when %s', (_label, overrides) => {
      renderSheet({ reminder: reminder(overrides) });
      expect(screen.queryByRole('checkbox', { name: OPT_IN })).not.toBeInTheDocument();
    });

    // iOS Safari in a tab has no push at all: the honest offer is the way to
    // get it, not a box that cannot do anything.
    it('offers the iPhone instructions instead of the box in iOS Safari', async () => {
      const user = userEvent.setup();
      const r = reminder({ support: 'ios-install-first' });
      renderSheet({ reminder: r });
      expect(screen.queryByRole('checkbox', { name: OPT_IN })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Jak włączyć na iPhonie' }));
      expect(screen.getByRole('heading', { name: 'Przypomnienia na iPhonie' })).toBeInTheDocument();
      expect(r.enable).not.toHaveBeenCalled();
    });

    it('passes accessibility check with the box', async () => {
      const { baseElement } = renderSheet({ reminder: reminder() });
      const results = await axe(baseElement);
      expect(results).toHaveNoViolations();
    });
  });
});
