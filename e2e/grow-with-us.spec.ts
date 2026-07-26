import { test, expect } from '@playwright/test';
import { TEXT } from './support/helpers';

// The "Rozwijaj z nami" page. It lives OUTSIDE the /{city} subtree (static
// segment, resolved ahead of /[city]) and holds the two feedback channels, so
// the assertions that matter are: the route resolves, and both outbound links
// point where they should. Destination URLs are mirrored from
// src/config/community.ts — the same hand-mirroring convention the rest of this
// suite uses for i18n strings.
const GROW_PATH = '/rozwijaj-z-nami';
const DISCORD_INVITE_URL = 'https://discord.gg/dbSmbbCSa';
const FEEDBACK_FORM_URL = 'https://forms.gle/LpRDCRVTBE6yx7M96';

test.describe('Grow with us', () => {
  test('renders the page at its own top-level route', async ({ page }) => {
    await page.goto(GROW_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(TEXT.growNav);
    await expect(page.getByText(TEXT.growPunch)).toBeVisible();
  });

  test('both feedback channels link out in a new tab', async ({ page }) => {
    await page.goto(GROW_PATH);

    const discord = page.getByRole('link', { name: new RegExp(TEXT.growDiscordCta) });
    await expect(discord).toHaveAttribute('href', DISCORD_INVITE_URL);
    await expect(discord).toHaveAttribute('target', '_blank');
    await expect(discord).toHaveAttribute('rel', /noopener/);

    const form = page.getByRole('link', { name: new RegExp(TEXT.growFormCta) });
    await expect(form).toHaveAttribute('href', FEEDBACK_FORM_URL);
    await expect(form).toHaveAttribute('target', '_blank');
    await expect(form).toHaveAttribute('rel', /noreferrer/);
  });

  test('is reachable from the footer on any city route', async ({ page }) => {
    // The footer link works at every viewport (the header nav collapses into a
    // drawer below md), which makes it the stable entry point to assert.
    await page.goto('/wroclaw');
    await page.getByRole('contentinfo').getByRole('link', { name: TEXT.growNav }).click();

    await expect(page).toHaveURL(new RegExp(`${GROW_PATH}(/|$)`));
    await expect(page.getByText(TEXT.growPunch)).toBeVisible();
  });

  test('copy follows the language switch', async ({ page }) => {
    await page.goto(GROW_PATH);
    await expect(page.getByText(TEXT.growPunch)).toBeVisible();

    await page.getByRole('button', { name: TEXT.langEn }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      TEXT.growHeadlineEn
    );
  });
});
