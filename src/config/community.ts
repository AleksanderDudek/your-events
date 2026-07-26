// Where "Rozwijaj z nami" points people who want a say in the app.
//
// Kept in one module so the page, the header nav, the footer and the sitemap
// can never drift apart — swapping an invite or moving the route is a one-line
// change here instead of a grep across the tree.

// Route of the "Rozwijaj z nami" page. A STATIC segment, so Next resolves it
// ahead of the dynamic /[city] segment — no city id can shadow it.
export const GROW_WITH_US_PATH = '/rozwijaj-z-nami';

// Community Discord invite (non-expiring).
export const DISCORD_INVITE_URL = 'https://discord.gg/dbSmbbCSa';

// Google Forms survey — the no-Discord way to send feedback.
export const FEEDBACK_FORM_URL = 'https://forms.gle/LpRDCRVTBE6yx7M96';
