import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample, expectNoHorizontalScroll } from './helpers';

async function axe(page: Page, context: string) {
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), context).toEqual([]);
}

test('timeline shows one bar per dated person, toggles history, and jumps to the tree', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.locator('.timeline-row')).toHaveCount(47);
  await expect(page.getByText('1 person without a year of birth is not shown')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await axe(page, 'timeline');
  await page.getByLabel('Show historical events').check();
  await expect(page.locator('svg text', { hasText: 'First World War' })).toBeVisible();
  await page.getByLabel('Order').selectOption('family');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Show Karl Weber in the tree' }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Karl Weber, born 1878/ })).toHaveAttribute('aria-pressed', 'true');
});

test('statistics state their base population and offer data tables', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await expect(page.getByText(/^Basis: \d+ of 48 people$/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Average age at death by decade of birth' })).toBeVisible();
  await expect(page.getByText(/^Basis: 16 of 17 partnerships$/)).toBeVisible();
  const table = page.locator('details').filter({ hasText: 'Show as a table' }).first();
  await table.locator('summary').click();
  await expect(table.getByRole('table')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await axe(page, 'statistics');
});
