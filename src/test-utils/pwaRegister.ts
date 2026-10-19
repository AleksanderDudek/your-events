// Stand-in for vite-plugin-pwa's `virtual:pwa-register/react`, which only exists
// inside a Vite build with the plugin loaded. Wired up by vitest.config.ts; a
// spec that cares about the service worker replaces it with vi.mock().
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: async () => {},
  };
}
