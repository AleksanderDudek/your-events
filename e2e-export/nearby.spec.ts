import { test, expect } from '@playwright/test';

// The nearby filter against the STATIC EXPORT. Its state lives in the query
// string like every other filter's, so it inherits the export-only failure
// this suite exists for: a push to the same route snapping back to the query
// the document was cold-loaded with (see paging-and-view.spec.ts). A point
// arriving by a shared link is exactly such a cold load.

const CITY = 'wroclaw';
const LIST = `/${CITY}/wydarzenia/`;
// Wrocław's Rynek, 3 km: wide enough that the old town fills more than a page.
const NEAR = '?near=51.11,17.032&radius=3000';

type P = import('@playwright/test').Page;

async function currentPage(page: P): Promise<string | null> {
  return page.evaluate(
    () => document.querySelector('.MuiPagination-root .Mui-selected')?.textContent ?? null
  );
}

test.describe('Static export: the nearby filter', () => {
  test('a cold-loaded point survives paging, and its chip removes it', async ({ page }) => {
    await page.goto(`${LIST}${NEAR}`);
    await expect(page.locator('article').first()).toBeVisible({ timeout: 20000 });
    const chip = page.locator('.MuiChip-root').filter({ hasText: /W promieniu 3\skm/ });
    await expect(chip).toBeVisible();

    // Paging under a client-side filter is the scan-then-fetch path; on the
    // export it must also not be undone by the cold-load URL.
    const nextPage = page.getByRole('button', { name: 'Go to page 2' }).first();
    if (await nextPage.isVisible().catch(() => false)) {
      await nextPage.click();
      await expect.poll(() => currentPage(page)).toBe('2');
      await expect(page).toHaveURL(/[?&]page=2(&|$)/);
      await expect(page).toHaveURL(/[?&]near=51\.11(,|%2C)17\.032(&|$)/);
      await expect(page.locator('article').first()).toBeVisible();
    }

    await chip.locator('.MuiChip-deleteIcon').click();
    await expect(page).not.toHaveURL(/[?&]near=/);
    await expect(chip).toHaveCount(0);
  });
});
