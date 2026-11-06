import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { PushReminder } from '@/components/service/usePushReminder';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { trackEvent } from '@/lib/analytics';
import PushReminderCard from './PushReminderCard';

function reminder(over: Partial<PushReminder> = {}): PushReminder {
  return {
    available: true,
    support: 'ready',
    enabled: false,
    markedId: null,
    busy: false,
    enable: vi.fn(async () => 'enabled' as const),
    disable: vi.fn(async () => undefined),
    toggleMark: vi.fn(async () => 'marked' as const),
    ...over,
  };
}

describe('PushReminderCard', () => {
  it('renders nothing when the feature is off or unsupported', () => {
    const { container, rerender } = render(<PushReminderCard reminder={reminder({ available: false })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PushReminderCard reminder={reminder({ support: 'unsupported' })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PushReminderCard reminder={reminder({ support: 'checking' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the switch turns reminders on and off', async () => {
    const r = reminder();
    const { rerender } = render(<PushReminderCard reminder={r} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Przypominaj mi' }));
    expect(r.enable).toHaveBeenCalled();

    const on = reminder({ enabled: true });
    rerender(<PushReminderCard reminder={on} />);
    expect(screen.getByRole('switch', { name: 'Przypominaj mi' })).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Przypominaj mi' }));
    expect(on.disable).toHaveBeenCalled();
  });

  it('says so when switching on failed', async () => {
    render(<PushReminderCard reminder={reminder({ enable: vi.fn(async () => 'failed' as const) })} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Przypominaj mi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się włączyć przypomnień');
  });

  it('explains a blocked permission instead of offering the switch', () => {
    render(<PushReminderCard reminder={reminder({ support: 'blocked' })} />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText(/są zablokowane/)).toBeInTheDocument();
  });

  it('on an iPhone in Safari shows the install steps', async () => {
    render(<PushReminderCard reminder={reminder({ support: 'ios-install-first' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Jak włączyć na iPhonie' }));
    expect(await screen.findByRole('dialog', { name: 'Przypomnienia na iPhonie' })).toBeInTheDocument();
    expect(screen.getByText(/Do ekranu początkowego/)).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('push_ios_install_shown');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PushReminderCard reminder={reminder()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
