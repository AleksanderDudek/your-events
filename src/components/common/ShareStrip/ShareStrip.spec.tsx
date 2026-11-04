import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ShareStrip from './ShareStrip';
import { hideShareStrip, resetShareStoreForTests, useShareDialog } from '@/components/service/usePromoShare';
import { SHARE_STRIP_INIT_SCRIPT, SHARE_STRIP_STORAGE_KEY } from '@/lib/shareStrip';

function DialogProbe() {
  const { isOpen } = useShareDialog();
  return <span data-testid="dialog">{isOpen ? 'open' : 'closed'}</span>;
}

beforeEach(() => {
  resetShareStoreForTests();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-share-strip');
});

describe('ShareStrip', () => {
  it('says why sharing helps, and opens the share dialog', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ShareStrip />
        <DialogProbe />
      </>
    );
    await user.click(screen.getByRole('button', { name: /będzie z kim iść/ }));
    expect(screen.getByTestId('dialog')).toHaveTextContent('open');
  });

  it('hides for good with its ×, in storage and on <html>', async () => {
    const user = userEvent.setup();
    render(<ShareStrip />);
    await user.click(screen.getByRole('button', { name: 'Ukryj pasek polecania' }));
    expect(screen.queryByRole('button', { name: /będzie z kim iść/ })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SHARE_STRIP_STORAGE_KEY)).toBe('dismissed');
    expect(document.documentElement).toHaveAttribute('data-share-strip', 'off');
  });

  it('goes away once the visitor has shared', () => {
    render(<ShareStrip />);
    act(() => hideShareStrip('shared'));
    expect(screen.queryByRole('button', { name: /będzie z kim iść/ })).not.toBeInTheDocument();
  });

  it('stays hidden for a visitor who hid it before', () => {
    window.localStorage.setItem(SHARE_STRIP_STORAGE_KEY, 'dismissed');
    render(<ShareStrip />);
    expect(screen.queryByRole('button', { name: /będzie z kim iść/ })).not.toBeInTheDocument();
  });

  it('ships a pre-paint script that sets the attribute from storage', () => {
    window.localStorage.setItem(SHARE_STRIP_STORAGE_KEY, 'dismissed');
    new Function(SHARE_STRIP_INIT_SCRIPT)();
    expect(document.documentElement).toHaveAttribute('data-share-strip', 'off');
  });

  it('passes accessibility check', async () => {
    const { container } = render(<ShareStrip />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
