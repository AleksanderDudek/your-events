import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { trackEvent } from '@/lib/analytics';
import PushOpenTracker from './PushOpenTracker';

describe('PushOpenTracker', () => {
  beforeEach(() => {
    vi.mocked(trackEvent).mockClear();
  });

  it('counts a visit from a reminder once and strips the marker', () => {
    window.history.replaceState(null, '', '/moje-filtry/?open=p1&src=push');
    render(<PushOpenTracker />);
    expect(trackEvent).toHaveBeenCalledWith('push_open');
    expect(window.location.search).toBe('?open=p1');
  });

  it('ignores an ordinary visit', () => {
    window.history.replaceState(null, '', '/?a=1');
    render(<PushOpenTracker />);
    expect(trackEvent).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?a=1');
  });
});
