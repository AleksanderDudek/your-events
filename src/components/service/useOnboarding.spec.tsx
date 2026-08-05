// @vitest-environment node
//
// Same guard as useConsent's suite, for the same reason. `getServerSnapshot()`
// reports "nothing stored", and "nothing stored" is also the condition that
// opens the welcome sheet — so without a second gate the sheet would be open
// during the prerender and ship inside the static HTML of all 1000+ exported
// pages, flashing at every returning visitor before hydration corrects it.
//
// `isReady` (a second useSyncExternalStore whose server snapshot is `false`) is
// that gate. Remove it and this test fails.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useOnboarding } from './useOnboarding';

function Probe() {
  const { isReady, hasSeen } = useOnboarding();
  return <div data-ready={String(isReady)} data-seen={String(hasSeen)} />;
}

describe('useOnboarding (server render)', () => {
  it('is never ready on a real server render', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('data-ready="false"');
    expect(html).not.toContain('data-ready="true"');
  });

  it('does not throw reaching for localStorage during the prerender', () => {
    expect(() => renderToStaticMarkup(<Probe />)).not.toThrow();
  });
});
