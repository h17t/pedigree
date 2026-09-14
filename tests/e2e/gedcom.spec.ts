import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

const fixture = 'tests/gedcom/gramps-utf8.ged';

test('import a GEDCOM file as a new tree, read the report, then export it', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a GEDCOM file' }).click();
  await (await chooser).setFiles(fixture);
  await expect(page.getByRole('dialog', { name: 'Import report' })).toBeVisible();
  await expect(page.getByText('Declared as UTF-8, read as utf-8')).toBeVisible();
  await expect(page.getByText('SEX X was read as "diverse".')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.getByRole('button', { name: 'Close report' }).click();
  // The imported file became its own tree, named after the file, with 7 people.
  await expect(page.locator('dd', { hasText: 'gramps utf8' })).toBeVisible();
  await expect(page.locator('dd', { hasText: /^7$/ }).first()).toBeVisible();
  // Export
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as GEDCOM file' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/^family-tree-gramps-utf8-\d{4}-\d{2}-\d{2}\.ged$/);
  await expect(page.getByRole('dialog', { name: 'Export report' })).toBeVisible();
  await expect(page.getByText('Custom fields were written as _UDF lines')).toBeVisible();
});

test('merge-import adds people to the open tree as one undo step and lists duplicates', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Into this family tree').check();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a GEDCOM file' }).click();
  await (await chooser).setFiles(fixture);
  await expect(page.getByRole('dialog', { name: 'Import report' })).toBeVisible();
  await page.getByRole('button', { name: 'Close report' }).click();
  await expect(page.getByText('Added 7 people from gramps-utf8.ged to this tree.')).toBeVisible();
  await expect(page.locator('dd', { hasText: /^55$/ }).first()).toBeVisible();
  // Karl Weber 1878 exists twice now → a possible duplicate
  await expect(page.getByRole('button', { name: 'Compare and merge' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('dd', { hasText: /^48$/ }).first()).toBeVisible();
});

test('a GEDCOM 7 file is read and the report says so', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a GEDCOM file' }).click();
  await (await chooser).setFiles('tests/gedcom/gedcom7.ged');
  await expect(page.getByRole('dialog', { name: 'Import report' })).toBeVisible();
  await expect(page.getByText('This is a GEDCOM 7 file.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close report' }).click();
  await expect(page.locator('dd', { hasText: /^3$/ }).first()).toBeVisible();
});
