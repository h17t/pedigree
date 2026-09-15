import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

async function openPrint(page: Page) {
  await openSample(page);
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Arrange the whole tree' }).click();
  await page.getByRole('button', { name: 'Print & export' }).click();
  await expect(page.getByRole('dialog', { name: 'Print and export' })).toBeVisible();
}

test('print dialog: preview, legibility warning, tiling and sheet count, accessibility', async ({ page }) => {
  await openPrint(page);
  const dialog = page.getByRole('dialog', { name: 'Print and export' });
  await expect(dialog.locator('.print-sheet > svg')).toBeVisible();
  // The whole 48-person tree on one A4 sheet is too small to read: the warning lists alternatives in order.
  await expect(dialog.getByText(/Smallest text on paper: about [\d.,]+ pt · 1 sheet/)).toBeVisible();
  await expect(dialog.getByText(/At this size the smallest text/)).toBeVisible();
  const items = dialog.locator('.notice-warn ol li');
  await expect(items.first()).toHaveText('Spread the tree across several sheets');
  await expect(items.nth(1)).toHaveText('Save a PDF or an SVG file and have it printed larger at a print shop');
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  // Tiling at 100 % gives several numbered sheets and a legible size.
  await dialog.getByLabel('Spread across several sheets').check();
  await expect(dialog.getByText(/Smallest text on paper: about 11[.,]3 pt · \d+ sheets/)).toBeVisible();
  await expect(dialog.getByText(/At this size the smallest text/)).toHaveCount(0);
  await dialog.getByRole('button', { name: '›' }).click();
  await expect(dialog.getByText(/Sheet 2 of \d+/).first()).toBeVisible();
  // A3 and larger recommend the SVG route
  await dialog.getByLabel('Paper size').selectOption('A2');
  await expect(dialog.getByText('A3 and larger rarely work through a home printer.')).toBeVisible();
  // 600 dpi on A2 exceeds the PNG cap: the option is disabled and the button explains
  await expect(dialog.locator('#pr-dpi option[value="600"]')).toBeDisabled();
});

test('saves an SVG with embedded fonts and prints through the browser', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed += document.querySelectorAll('#print-root .print-page').length;
      setTimeout(() => window.dispatchEvent(new Event('afterprint')), 20);
    };
  });
  await openPrint(page);
  const dialog = page.getByRole('dialog', { name: 'Print and export' });
  await dialog.getByLabel(/One family: family 2/).check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save an SVG file' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/^family-tree-Sample-family-Weber-and-Koch-\d{4}-\d{2}-\d{2}\.svg$/);
  const path = await d.path();
  const text = (await import('node:fs')).readFileSync(path, 'utf8');
  expect(text).toContain('@font-face');
  expect(text).toContain('data:font/woff2;base64,');
  expect(text).toContain('Johann Lindner');
  expect(text).not.toContain('Karl Weber');
  expect(text).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="297mm" height="210mm"/);
  await dialog.getByRole('button', { name: 'Print…' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  await expect(page.locator('#print-root')).toHaveCount(0);
});

test('timeline and statistics can be printed as sheets', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await page.getByRole('button', { name: 'Print & export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Print and export' });
  await expect(dialog.getByLabel('Statistics sheet')).toBeChecked();
  await expect(dialog.locator('.print-sheet > svg')).toBeVisible();
  await dialog.getByLabel('Timeline').check();
  await expect(dialog.locator('.print-sheet svg text', { hasText: 'Karl Weber' }).first()).toBeAttached();
});

test('saves a PDF with one page per sheet, real text and the fonts inside it', async ({ page }) => {
  await openPrint(page);
  const dialog = page.getByRole('dialog', { name: 'Print and export' });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save a PDF' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/^family-tree-Sample-family-Weber-and-Koch-\d{4}-\d{2}-\d{2}\.pdf$/);
  const bytes = (await import('node:fs')).readFileSync(await d.path());
  const text = bytes.toString('latin1');
  expect(text.startsWith('%PDF-1.7')).toBe(true);
  expect(text.endsWith('%%EOF\n')).toBe(true);
  expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
  // A4 landscape in points, the fonts embedded, and the text kept as text.
  expect(text).toContain('/MediaBox [0 0 841.89 595.28]');
  expect(text).toContain('/FontFile2');
  expect(text).toContain('/Encoding /Identity-H');
  expect(text).toContain('/ToUnicode');
  expect(bytes.length).toBeGreaterThan(20_000);
});

test('a PDF of a tree written in Japanese carries the East Asian fonts too', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Language').selectOption('ja');
  await page.getByRole('button', { name: '系図', exact: true }).click();
  await page.getByRole('button', { name: '配置' }).click();
  await page.getByRole('button', { name: '家系図全体を整列' }).click();
  await page.getByRole('button', { name: '印刷と書き出し' }).click();
  const dialog = page.getByRole('dialog').first();
  // The title, the legend and the date are Japanese, so the sheet needs those fonts.
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'PDF を保存' }).click();
  const d = await download;
  const bytes = (await import('node:fs')).readFileSync(await d.path());
  const text = bytes.toString('latin1');
  expect(text.startsWith('%PDF-1.7')).toBe(true);
  // Chunks of the East Asian family, not the whole font, sit beside the Latin one.
  const fonts = [...text.matchAll(/\/FontName \/(\w+)/g)].map((m) => m[1]);
  expect(fonts.some((n) => n.startsWith('notosans'))).toBe(true);
  expect(fonts.length).toBeLessThan(40);
  expect(text).toContain('/Encoding /Identity-H');
});
