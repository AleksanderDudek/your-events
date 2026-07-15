import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TEXT, CITY, firstCard, gotoEvents } from './support/helpers';

// Derive the violation type from AxeBuilder's own result rather than importing
// `axe-core` directly — under pnpm's strict node_modules it is a transitive dep
// and not resolvable from here.
type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

// Automated accessibility gate on the three primary surfaces. Axe can't catch
// everything, but it reliably flags STRUCTURAL a11y regressions — missing form
// labels, invalid ARIA, buttons with no accessible name, images without alt.
//
// We fail only on `serious`/`critical` impact and skip two design/layout-owned
// rules that are noisy here and not structural-code regressions:
//   • color-contrast — a brand-palette decision, not a markup bug.
//   • region        — "content outside a landmark", triggered by full-bleed
//                     hero/map layouts by design.
function scan(page: Page) {
  return new AxeBuilder({ page }).disableRules(['color-contrast', 'region']).analyze();
}

function summarize(violations: Violation[]): string {
  return violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
    .join('\n');
}

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await scan(page);
  const serious = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(serious, `Accessibility violations:\n${summarize(serious)}`).toEqual([]);
}

test.describe('Accessibility (axe)', () => {
  test('city picker has no serious violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(TEXT.cityPickerTitle)).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('events list (grid) has no serious violations', async ({ page }) => {
    // Default grid view — deliberately not the map, whose third-party Leaflet
    // tiles/controls carry a11y noise we don't own.
    await gotoEvents(page);
    await expectNoSeriousViolations(page);
  });

  test('event detail has no serious violations', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}/`));
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
    // Wait for the async metadata title to land before scanning: in `next dev`
    // client navigation updates document.title a beat after the DOM, and an
    // empty title trips axe's document-title rule (a dev-only race — the static
    // export ships the <title> in the HTML).
    await expect(page).toHaveTitle(/\S/);
    await expectNoSeriousViolations(page);
  });
});
