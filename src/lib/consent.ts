// Pure consent helpers. The browser-storage side lives in
// components/service/useConsent, mirroring the lib/presets split so the rules
// with teeth can be tested without a DOM.

export type ConsentChoice = 'accepted' | 'rejected';

export const CONSENT_STORAGE_KEY = 'go-to-city.consent';

const CHOICES: readonly ConsentChoice[] = ['accepted', 'rejected'];

// A stored value is only honoured if it is exactly one of the known choices.
// Anything else — absent, empty, an old format, hand-edited junk — reads as
// "no choice yet", which shows the banner again rather than silently assuming
// consent.
export function parseConsent(raw: string | null): ConsentChoice | null {
  if (raw === null) return null;
  return (CHOICES as readonly string[]).includes(raw) ? (raw as ConsentChoice) : null;
}
