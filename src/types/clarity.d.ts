// Microsoft Clarity's tag defines this. It is absent wherever the tag is gated
// off (dev, both Playwright suites), so every call site must use `?.`.
interface ClarityConsentV2 {
  ad_Storage: 'granted' | 'denied';
  analytics_Storage: 'granted' | 'denied';
}

declare global {
  interface Window {
    clarity?: (command: 'consentv2', consent: ClarityConsentV2) => void;
  }
}

export {};
