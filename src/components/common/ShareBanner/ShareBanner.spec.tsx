import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ShareBanner from './ShareBanner';
import {
  SHARE_BANNER_STORAGE_KEY,
  resetShareStoreForTests,
  useShareDialog,
} from '@/components/service/usePromoShare';

beforeEach(() => {
  localStorage.clear();
  resetShareStoreForTests();
});

describe('ShareBanner', () => {
  it('invites the visitor to recommend the app', () => {
    render(<ShareBanner />);
    expect(screen.getByRole('heading', { name: /co dziś robimy\?/ })).toBeInTheDocument();
  });

  it('opens the share dialog', async () => {
    const user = userEvent.setup();
    const dialog = renderHook(() => useShareDialog());
    render(<ShareBanner />);
    await user.click(screen.getByRole('button', { name: 'Udostępnij' }));
    expect(dialog.result.current.isOpen).toBe(true);
  });

  it('stays hidden once dismissed', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ShareBanner />);
    await user.click(screen.getByRole('button', { name: 'Ukryj baner' }));
    expect(screen.queryByRole('heading', { name: /co dziś robimy\?/ })).not.toBeInTheDocument();
    expect(localStorage.getItem(SHARE_BANNER_STORAGE_KEY)).toBe('dismissed');

    unmount();
    resetShareStoreForTests(); // a new visit: only localStorage remembers
    render(<ShareBanner />);
    expect(screen.queryByRole('heading', { name: /co dziś robimy\?/ })).not.toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<ShareBanner />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
