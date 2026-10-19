import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useRegisterSW, updateServiceWorker, setNeedRefresh, state } = vi.hoisted(() => ({
  useRegisterSW: vi.fn(),
  updateServiceWorker: vi.fn(),
  setNeedRefresh: vi.fn(),
  state: { needRefresh: false },
}));

// The real module only exists inside a vite-plugin-pwa build.
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW }));

import PwaUpdatePrompt from './PwaUpdatePrompt';

beforeEach(() => {
  vi.clearAllMocks();
  state.needRefresh = false;
  useRegisterSW.mockImplementation(() => ({
    needRefresh: [state.needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }));
});

describe('PwaUpdatePrompt', () => {
  it('stays silent while the running version is current', () => {
    render(<PwaUpdatePrompt />);
    expect(screen.queryByText('Dostępna jest nowa wersja aplikacji.')).not.toBeInTheDocument();
  });

  // Registering waits for the page's own load, so the service worker's
  // precache download never competes with the first paint.
  it('registers the service worker without jumping ahead of the page load', () => {
    render(<PwaUpdatePrompt />);
    expect(useRegisterSW).toHaveBeenCalledWith(expect.objectContaining({ immediate: false }));
  });

  it('offers a reload once a new version is waiting', async () => {
    state.needRefresh = true;
    const user = userEvent.setup();
    const { container } = render(<PwaUpdatePrompt />);

    expect(screen.getByText('Dostępna jest nowa wersja aplikacji.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Odśwież' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  // Dismissing keeps the current version; the new one takes over on the next
  // visit, once every tab of the old one has closed.
  it('can be dismissed without updating', async () => {
    state.needRefresh = true;
    const user = userEvent.setup();
    render(<PwaUpdatePrompt />);

    await user.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });
});
