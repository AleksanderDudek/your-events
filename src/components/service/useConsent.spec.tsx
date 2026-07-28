// @vitest-environment node
//
// This suite runs with `window` genuinely undefined (a real server render,
// not a jsdom stand-in with globals torn down) because that is exactly the
// bug this hook has shipped twice: `getServerSnapshot()` returns a constant
// that parses to `choice = null`, and "no choice yet" is also the condition
// that opens the banner. Without a second gate, that constant alone makes
// `isOpen` true during the prerender — the banner would ship open in the
// static HTML of every one of the 1000+ prerendered pages and flash at every
// visitor who already answered. The `isHydrated` gate (a second
// useSyncExternalStore whose server snapshot is `false`) is what actually
// keeps the banner closed until hydration. This test exists so that gate
// cannot later be "simplified away" as redundant — remove it and this test
// fails.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useConsent } from './useConsent';

function Probe() {
  const { isOpen } = useConsent();
  return <div data-open={String(isOpen)} />;
}

describe('useConsent (server render)', () => {
  it('never reports isOpen on a real server render', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('data-open="false"');
    expect(html).not.toContain('data-open="true"');
  });
});
