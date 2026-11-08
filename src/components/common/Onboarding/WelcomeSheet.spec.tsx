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
  const onReminderAnswered = vi.fn();
  const result = render(
    <LocaleProvider>
      <WelcomeSheet
        cityLocative="Szczecinie"
        onSkip={onSkip}
        onStart={onStart}
        reminder={overrides.reminder}
        onReminderAnswered={onReminderAnswered}
      />
    </LocaleProvider>
  );
  return { ...result, onSkip, onStart, onReminderAnswered };
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

const STEP_TITLE = { name: 'Nie przegap nowych wydarzeń' };
const ENABLE = { name: 'Włącz powiadomienia' };
const LATER = { name: 'Nie teraz' };

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

  describe('the notification step', () => {
    // Skipping the tour is not declining reminders: both buttons lead here.
    it.each([
      ['Pokaż mi', 'onStart'],
      ['Pomiń', 'onSkip'],
    ] as const)('follows "%s" and only then runs it', async (button, handler) => {
      const user = userEvent.setup();
      const r = reminder();
      const props = renderSheet({ reminder: r });
      await user.click(screen.getByRole('button', { name: button }));
      expect(screen.getByRole('heading', STEP_TITLE)).toBeInTheDocument();
      expect(props[handler]).not.toHaveBeenCalled();
      expect(r.enable).not.toHaveBeenCalled();
    });

    // The button is the click the browser needs, so the device's own
    // permission prompt appears the moment it is pressed.
    it('asks the device for permission on "Włącz powiadomienia", then carries on', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onStart, onReminderAnswered } = renderSheet({ reminder: r });
      await user.click(screen.getByRole('button', { name: 'Pokaż mi' }));
      await user.click(screen.getByRole('button', ENABLE));
      expect(r.enable).toHaveBeenCalledOnce();
      expect(onStart).toHaveBeenCalledOnce();
      expect(onReminderAnswered).toHaveBeenCalledOnce();
    });

    it('carries on without asking on "Nie teraz"', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onSkip, onReminderAnswered } = renderSheet({ reminder: r });
      await user.click(screen.getByRole('button', { name: 'Pomiń' }));
      await user.click(screen.getByRole('button', LATER));
      expect(r.enable).not.toHaveBeenCalled();
      expect(onSkip).toHaveBeenCalledOnce();
      expect(onReminderAnswered).toHaveBeenCalledOnce();
    });

    it('treats Escape on the step as "not now"', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onStart, onReminderAnswered } = renderSheet({ reminder: r });
      await user.click(screen.getByRole('button', { name: 'Pokaż mi' }));
      await user.keyboard('{Escape}');
      expect(r.enable).not.toHaveBeenCalled();
      expect(onStart).toHaveBeenCalledOnce();
      expect(onReminderAnswered).toHaveBeenCalledOnce();
    });

    // Escape on the welcome page is a dismissal of everything.
    it('is skipped when the welcome sheet itself is dismissed with Escape', async () => {
      const user = userEvent.setup();
      const r = reminder();
      const { onSkip } = renderSheet({ reminder: r });
      await user.keyboard('{Escape}');
      expect(onSkip).toHaveBeenCalledOnce();
      expect(screen.queryByRole('heading', STEP_TITLE)).not.toBeInTheDocument();
    });

    it.each([
      ['the feature is off', { available: false }],
      ['reminders are already on', { enabled: true }],
      ['support is still being checked', { support: 'checking' as const }],
      ['the browser blocked notifications', { support: 'blocked' as const }],
      ['the browser cannot do push', { support: 'unsupported' as const }],
    ])('is not shown when %s', async (_label, overrides) => {
      const user = userEvent.setup();
      const { onStart } = renderSheet({ reminder: reminder(overrides) });
      await user.click(screen.getByRole('button', { name: 'Pokaż mi' }));
      expect(onStart).toHaveBeenCalledOnce();
      expect(screen.queryByRole('heading', STEP_TITLE)).not.toBeInTheDocument();
    });

    // iOS Safari in a tab has no push at all: the honest offer is the way to
    // get it, not a button that cannot do anything.
    it('offers the iPhone instructions in iOS Safari', async () => {
      const user = userEvent.setup();
      const r = reminder({ support: 'ios-install-first' });
      const { onSkip } = renderSheet({ reminder: r });
      await user.click(screen.getByRole('button', { name: 'Pomiń' }));
      expect(screen.queryByRole('button', ENABLE)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Jak włączyć na iPhonie' }));
      expect(screen.getByRole('heading', { name: 'Przypomnienia na iPhonie' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Rozumiem' }));
      expect(onSkip).toHaveBeenCalledOnce();
      expect(r.enable).not.toHaveBeenCalled();
    });

    it('passes accessibility check', async () => {
      const user = userEvent.setup();
      const { baseElement } = renderSheet({ reminder: reminder() });
      await user.click(screen.getByRole('button', { name: 'Pokaż mi' }));
      const results = await axe(baseElement);
      expect(results).toHaveNoViolations();
    });
  });
});
