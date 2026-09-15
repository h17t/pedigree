import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function axe(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), context).toEqual([]);
}

const luminance = async (page: Page, selector: string) => {
  const rgb = await page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const m = rgb.match(/\d+/g)!.map(Number);
  return (m[0] + m[1] + m[2]) / 3;
};

test('the dark theme follows the device by default, passes axe on every view, and prints light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openSample(page);
  // No explicit choice: the system preference decides.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  expect(await luminance(page, 'body')).toBeLessThan(80);
  await axe(page, 'list, dark');
  await page.getByLabel('Find a person by name').fill('karl weber');
  await page.getByRole('button', { name: /Karl Weber/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Karl Weber' })).toBeVisible();
  await axe(page, 'details, dark');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await axe(page, 'person form, dark');
  await page.getByRole('button', { name: isPhone(page) ? 'Back' : 'Discard changes' }).click();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  expect(await luminance(page, 'svg.tree-canvas')).toBeLessThan(60);
  await page.getByRole('button', { name: 'Legend' }).click();
  await axe(page, 'canvas with legend, dark');
  await page.getByRole('button', { name: 'Legend' }).click();
  // Print preview and the SVG file keep the light palette.
  await page.getByRole('button', { name: 'Print & export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Print and export' });
  await expect(dialog).toBeVisible();
  await axe(page, 'print dialog, dark');
  const preview = await dialog.locator('.print-preview svg').first().evaluate((el) => el.outerHTML);
  expect(preview).toContain('#1B2733');
  expect(preview).not.toContain('var(--');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save an SVG file' }).click();
  const svg = (await import('node:fs')).readFileSync((await (await download).path()), 'utf8');
  expect(svg).toContain('#1B2733');
  expect(svg).toContain('#FFFFFF');
  expect(svg).not.toContain('var(--');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await axe(page, 'data, dark');
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await axe(page, 'timeline, dark');
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await axe(page, 'statistics, dark');
});

test('the appearance setting overrides the device and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByLabel('Appearance')).toHaveValue('system');
  await page.getByLabel('Appearance').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await luminance(page, 'body')).toBeGreaterThan(200);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByLabel('Appearance').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await luminance(page, 'body')).toBeLessThan(80);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#161C22');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByLabel('Appearance')).toHaveValue('dark');
  await axe(page, 'data, explicit dark');
});

test('one chosen tint colour serves both palettes: pale on paper, deep on a dark screen', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  const cardRect = page.locator('.person-card', { hasText: 'Anna' }).first().locator('rect').first();
  const luminance = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const light = await cardRect.evaluate((el) => el.getAttribute('fill'));
  expect(luminance(light!)).toBeGreaterThan(0.7);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Appearance').selectOption('dark');
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  const dark = await cardRect.evaluate((el) => el.getAttribute('fill'));
  expect(luminance(dark!)).toBeLessThan(0.1);
  // The stored choice did not change; only the palette it is drawn in did.
  expect(dark).not.toBe(light);
});
