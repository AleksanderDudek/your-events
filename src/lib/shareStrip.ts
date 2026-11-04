// Shared by the client store (usePromoShare) and the server root layout, which
// inlines the script below: so not in a 'use client' module, whose exports a
// server component would receive as client references rather than values.

export const SHARE_STRIP_STORAGE_KEY = 'go-to-city.share-strip';
export const SHARE_STRIP_ATTRIBUTE = 'data-share-strip';

// Runs in <head> before first paint. The strip is in the prerendered HTML for
// everyone; a visitor who hid it gets the attribute before the header is laid
// out, so CSS drops the strip and its height with no jump. Built from the
// constants so the key cannot drift from the store's.
export const SHARE_STRIP_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  SHARE_STRIP_STORAGE_KEY
)})==='dismissed')document.documentElement.setAttribute(${JSON.stringify(SHARE_STRIP_ATTRIBUTE)},'off')}catch(e){}`;
