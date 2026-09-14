import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function selectKarl(page: Page) {
  await page.getByLabel('Find a person by name').fill('karl weber');
  await page.getByRole('button', { name: /Karl Weber/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Karl Weber' })).toBeVisible();
}

test('a private person is marked on the card, can be hidden on the canvas, and is left out of SVG and GEDCOM exports', async ({ page }) => {
  await openSample(page);
  await selectKarl(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Private person').check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Karl Weber' })).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  // Card marker on the canvas; the toolbar toggle hides the person (off by default).
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.locator('.person-card [role="img"][aria-label="private"]')).toHaveCount(1);
  const toggle = page.getByRole('button', { name: 'Hide private people' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.person-card [role="img"][aria-label="private"]')).toHaveCount(0);
  await expect(page.locator('.person-card', { hasText: 'Karl Weber' })).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await toggle.click();
  await expect(page.locator('.person-card', { hasText: 'Karl Weber' })).toHaveCount(1);
  // Print & export: hidden by default there.
  await page.getByRole('button', { name: 'Print & export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Print and export' });
  await expect(dialog.getByLabel('Hide private people')).toBeChecked();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save an SVG file' }).click();
  const svg = (await import('node:fs')).readFileSync((await (await download).path()), 'utf8');
  expect(svg).toContain('Johann Lindner');
  expect(svg).not.toContain('Karl Weber');
  await dialog.getByLabel('Hide private people').uncheck();
  const download2 = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save an SVG file' }).click();
  const svg2 = (await import('node:fs')).readFileSync((await (await download2).path()), 'utf8');
  expect(svg2).toContain('Karl Weber');
  await page.keyboard.press('Escape');
  // GEDCOM export leaves the person out and says so.
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByLabel('Leave out private people')).toBeChecked();
  const ged = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as GEDCOM file' }).click();
  const gedText = (await import('node:fs')).readFileSync((await (await ged).path()), 'utf8');
  expect(gedText).not.toContain('Karl /Weber/');
  expect(gedText).toContain('Johann /Lindner/');
  await expect(page.getByText('1 private person was left out.')).toBeVisible();
});

test('date ranges are typed in the date field, shown on cards and details, and survive a reload together with the undo history', async ({ page }) => {
  await openSample(page);
  await selectKarl(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.locator('#pf-birth').fill('between 1920 and 1925');
  await expect(page.getByText('Understood as: between 1920 and 1925')).toBeVisible();
  await page.locator('#pf-death').fill('von 03.1988 bis 14.03.1988');
  await expect(page.getByText('Understood as: from March 1988 to 14 March 1988')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Karl Weber' })).toBeVisible();
  await expect(page.getByText('between 1920 and 1925', { exact: false }).first()).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.locator('.person-card', { hasText: 'Karl Weber' })).toContainText('1920–1925');
  // The change is saved; a reload of the same tab keeps the undo history.
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.locator('.person-card', { hasText: 'Karl Weber' })).not.toContainText('1920–1925');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('.person-card', { hasText: 'Karl Weber' })).toContainText('1920–1925');
  if (isPhone(page)) return;
  // A range in the family sheet reads as plain language.
  await page.locator('.person-card', { hasText: 'Karl Weber' }).click();
  await page.getByRole('button', { name: 'Family sheet' }).click();
  await expect(page.getByRole('dialog').getByText('between 1920 and 1925', { exact: false }).first()).toBeVisible();
});

test('the things-to-check list names a parent who would have been under 13', async ({ page }) => {
  await openSample(page);
  await selectKarl(page);
  await page.getByRole('group', { name: /Add child to the family with/ }).getByRole('button', { name: 'New person' }).click();
  await page.getByLabel('Given names').fill('Early');
  await page.locator('#pf-birth').fill('1889'); // Karl Weber was born in 1878
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Early Weber' })).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /things? to check/ }).first().click();
  await expect(page.getByText(/would have been under 13 at the birth of Early Weber/).first()).toBeVisible();
});
