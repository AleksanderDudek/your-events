// Clarity custom events. A no-op wherever the tag is absent (dev, tests) and,
// through Clarity's own consent handling, kept to the session when the visitor
// declined cookies — so call sites need no gate of their own.
//
// Names are snake_case and bounded (no event names, no free text): they become
// filter values in the Clarity dashboard.
export function trackEvent(name: string): void {
  try {
    window.clarity?.('event', name);
  } catch {
    // Analytics must never break a click.
  }
}
