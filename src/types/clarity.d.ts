// Microsoft Clarity's tag defines this. It is absent wherever the tag is gated
// off (dev, both Playwright suites), so every call site must use `?.`.
interface ClarityConsentV2 {
  ad_Storage: 'granted' | 'denied';
  analytics_Storage: 'granted' | 'denied';
}

declare global {
  interface Window {
    // Deliberately narrowed to the one command this codebase calls. Clarity's
    // real API is variadic (e.g. 'set', 'event', 'identify' take different
    // argument shapes) — add those as further overloads on this signature if
    // a future call site needs them, rather than widening this one.
    clarity?: (command: 'consentv2', consent: ClarityConsentV2) => void;
  }
}

export {};
