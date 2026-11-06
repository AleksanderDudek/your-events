import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadSite() {
  vi.resetModules();
  return import('./site');
}

describe('IS_PUSH_ENABLED', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUSH_ENABLED', '');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BKey');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(false);
  });

  it('needs the exact string true AND a VAPID key', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUSH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BKey');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(true);
  });

  it('treats a typo as off', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUSH_ENABLED', 'ture');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BKey');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(false);
  });
});
