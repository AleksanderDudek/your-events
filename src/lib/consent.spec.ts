import { describe, it, expect } from 'vitest';
import { CONSENT_STORAGE_KEY, parseConsent } from './consent';

describe('parseConsent', () => {
  it('accepts the two known values', () => {
    expect(parseConsent('accepted')).toBe('accepted');
    expect(parseConsent('rejected')).toBe('rejected');
  });

  it('treats anything else as no choice made', () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent('')).toBeNull();
    expect(parseConsent('yes')).toBeNull();
    expect(parseConsent('ACCEPTED')).toBeNull();
    expect(parseConsent('{"choice":"accepted"}')).toBeNull();
  });

  it('namespaces the storage key like the rest of the app', () => {
    expect(CONSENT_STORAGE_KEY).toBe('go-to-city.consent');
  });
});
