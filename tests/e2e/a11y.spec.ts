import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

/** axe-core over each view of stage (a). Violations block the build. */
async function expectNoViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
  expect(results.violations, `${context}\n${summary}`).toEqual([]);
}

test('project list has no accessibility violations', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('heading', { name: 'Your family trees' })).toBeVisible();
  await expectNoViolations(page, 'project list');
});

test('list view and details have no accessibility violations', async ({ page }) => {
  await openSample(page);
  await expectNoViolations(page, 'list view');
  await page.getByRole('button', { name: /Friedrich Weber/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Friedrich Weber' })).toBeVisible();
  await expectNoViolations(page, 'person details');
});

test('data view has no accessibility violations', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data' }).click();
  await expect(page.getByRole('heading', { name: 'Data and settings' })).toBeVisible();
  await expectNoViolations(page, 'data view');
});

test('language switch reaches German everywhere', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data' }).click();
  await page.getByLabel('Language').selectOption('de');
  await expect(page.getByRole('heading', { name: 'Daten und Einstellungen' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.getByRole('button', { name: 'Liste' }).click();
  await expect(page.getByRole('heading', { name: 'Familienliste' })).toBeVisible();
  await expectNoViolations(page, 'German list view');
});

test('search finds a person and the details show the full record', async ({ page }) => {
  await openSample(page);
  await page.getByLabel('Find a person by name').fill('wilhelmine');
  await expect(page.getByText('1 match')).toBeVisible();
  await page.getByRole('button', { name: /Wilhelmine/ }).click();
  await expect(page.getByRole('heading', { name: /Wilhelmine Charlotte Weber/ })).toBeVisible();
  await expect(page.getByText('Parents unknown')).toBeVisible();
});
