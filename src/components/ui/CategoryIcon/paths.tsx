import type { ReactNode } from 'react';

// Inner markup for each category glyph (brief §5). Rendered inside a
// <svg viewBox="0 0 24 24" stroke="currentColor" ...> so color is inherited.
// Keys are slugify(display_name).
export const CATEGORY_ICON_PATHS: Record<string, ReactNode> = {
  muzyka: (
    <>
      <path d="M9 18V6l8-2.5V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="14.5" cy="16" r="2.5" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="8.5" width="18" height="11" rx="2" />
      <path d="M3.5 8.5 5.5 4.5h15l-2 4M10.5 4.5l-2 4M15.5 4.5l-2 4" />
    </>
  ),
  'teatr-i-widowiska': (
    <>
      <path d="M6 5.5c2 .9 4 1.3 6 1.3s4-.4 6-1.3V12a6 6 0 0 1-12 0z" />
      <path d="M9.5 13.5a2.8 2.8 0 0 0 5 0" />
      <path d="M9.3 10.2h.01M14.7 10.2h.01" strokeWidth="2.4" />
    </>
  ),
  'sztuka-i-wystawy': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 15.5l4.5-4.5 4 4 2.5-2.5 5 5" />
      <circle cx="9.5" cy="9" r="1.4" />
    </>
  ),
  taniec: (
    <>
      <circle cx="14.2" cy="4.3" r="1.8" />
      <path d="M13.3 7.7c-.7 1.7-1.6 3.2-3 4.6" />
      <path d="M13.6 8.6l4 .9 2.7-2M12.9 8.2 9.6 6.7 8.3 4.2" />
      <path d="M10.3 12.3c-1.7 1.4-2.9 3.7-3.3 6.7M10.3 12.3c2.4.7 3.8 2.7 4.1 6.2" />
    </>
  ),
  'sport-i-fitness': (
    <>
      <circle cx="14.8" cy="4.4" r="1.8" />
      <path d="M13.8 7.9 11.5 12.6" />
      <path d="M14 8.8l3.4 1.5 2.6-1.2M13.4 8.6 10 8 8.2 5.8" />
      <path d="M11.5 12.6l3 2.6-.9 4.6M11.5 12.6 7.6 15.4l-3 -.4" />
    </>
  ),
  'wellness-i-duchowosc': (
    <>
      <path d="M12 4.5c1.7 1.7 1.7 4.6 0 6.3-1.7-1.7-1.7-4.6 0-6.3z" />
      <path d="M7.2 6.8c.3 2.5 1.4 4.4 3.4 5.6-2 .9-4 .7-5.6-.5.4-2 1.1-3.7 2.2-5.1zM16.8 6.8c-.3 2.5-1.4 4.4-3.4 5.6 2 .9 4 .7 5.6-.5-.4-2-1.1-3.7-2.2-5.1z" />
      <path d="M4 13.5c1 3.7 4.1 5.9 8 5.9s7-2.2 8-5.9c-2.8.2-5.5 1.2-8 2.9-2.5-1.7-5.2-2.7-8-2.9z" />
    </>
  ),
  warsztaty: (
    <>
      <rect x="3.5" y="9.5" width="17" height="10" rx="2" />
      <path d="M9.5 9.5V8a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 8v1.5" />
      <path d="M3.5 13.5H10M14 13.5h6.5" />
      <path d="M10 12h4v3.5h-4z" />
    </>
  ),
  edukacja: (
    <path d="M12 6.5C10 5 7.5 4.5 4 4.5v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-14c-3.5 0-6 .5-8 2v14" />
  ),
  'imprezy-i-rozrywka': (
    <>
      <path d="M9 9.5 4 20l10.5-5z" />
      <path d="M13.5 6.5 15 3M17.5 10.5 21 9M15.5 8.5l3.5-3.5" />
      <path d="M20 13.5h.01M11 4.5h.01" strokeWidth="2.4" />
    </>
  ),
  'dla-dzieci': (
    <>
      <path d="M12 3 18 9.3 12 17 6 9.3z" />
      <path d="M6 9.3h12M12 3v14" />
      <path d="M12 17c-1.3 1.4.7 2.3-.6 3.8" />
    </>
  ),
  zwierzeta: (
    <>
      <circle cx="5.8" cy="10.5" r="1.7" />
      <circle cx="9.8" cy="6.8" r="1.7" />
      <circle cx="14.2" cy="6.8" r="1.7" />
      <circle cx="18.2" cy="10.5" r="1.7" />
      <path d="M12 12c-2.8 0-5 2.3-5 4.8 0 1.4 1 2.4 2.4 2.4.9 0 1.7-.5 2.6-.5s1.7.5 2.6.5c1.4 0 2.4-1 2.4-2.4 0-2.5-2.2-4.8-5-4.8z" />
    </>
  ),
  inne: (
    <>
      <circle cx="7.5" cy="7.5" r="3.2" />
      <rect x="13.3" y="4.3" width="6.4" height="6.4" rx="1.5" />
      <path d="M12 13.6 15.7 19.8h-7.4z" />
    </>
  ),
};
