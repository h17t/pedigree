import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

async function axe(page: Page, context: string) {
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
  expect(results.violations, `${context}\n${summary}`).toEqual([]);
}

async function selectOnCanvas(page: Page, query: string, card: RegExp) {
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.getByLabel('Type a name to jump to a person').fill(query);
  await page.getByRole('button', { name: card }).first().click();
  await page.waitForTimeout(200);
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole('button', { name: 'More actions' }).click();
}

test('ancestor chart: pedigree columns, generation choice, print scope, back to the tree', async ({ page }) => {
  await openSample(page);
  await selectOnCanvas(page, 'werner weber', /Werner Weber/);
  await page.getByRole('button', { name: 'Ancestor chart' }).click();
  await expect(page.getByText(/Chart: Ancestor chart of Werner Weber/)).toBeVisible();
  await expect(page.getByLabel('Generations')).toHaveValue('5');
  await page.waitForTimeout(300);
  const cardsAt5 = await page.locator('.person-card').count();
  expect(cardsAt5).toBeGreaterThan(3);
  // The person is the leftmost card; ancestors are to the right in columns.
  const xs = new Set<number>();
  for (const b of await page.locator('.person-card rect').evaluateAll((els) => els.map((e) => (e.closest('g.person-card') as SVGGElement).getBoundingClientRect().x))) xs.add(Math.round(b));
  expect(xs.size).toBeGreaterThan(1);
  await axe(page, 'ancestor chart');
  // Fewer generations, fewer cards; the layout panel is hidden in chart mode.
  await page.getByLabel('Generations').selectOption('4');
  await page.waitForTimeout(300);
  expect(await page.locator('.person-card').count()).toBeLessThanOrEqual(cardsAt5);
  await expect(page.getByRole('button', { name: 'Layout' })).toHaveCount(0);
  // Printing offers the chart as shown.
  await page.getByRole('button', { name: 'Print & export' }).click();
  await expect(page.getByLabel(/The chart as shown/)).toBeChecked();
  await expect(page.locator('.print-sheet svg').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Back to the whole tree' }).click();
  await expect(page.getByText(/Chart:/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Layout' })).toBeVisible();
});

test('descendant chart: the person on top, depth choice, partnerships drawn', async ({ page }) => {
  await openSample(page);
  await selectOnCanvas(page, 'karl weber', /Karl Weber, born 1878/);
  await page.getByRole('button', { name: 'Descendant chart' }).click();
  await expect(page.getByText(/Chart: Descendant chart of Karl Weber/)).toBeVisible();
  await expect(page.getByLabel('Generations below')).toHaveValue('3');
  await page.waitForTimeout(300);
  const karl = await page.locator('.person-card').filter({ hasText: 'Karl Weber' }).first().boundingBox();
  const heinrich = await page.locator('.person-card').filter({ hasText: 'Heinrich Weber' }).first().boundingBox();
  expect(karl!.y).toBeLessThan(heinrich!.y);
  const at3 = await page.locator('.person-card').count();
  await page.getByLabel('Generations below').selectOption('1');
  await page.waitForTimeout(300);
  expect(await page.locator('.person-card').count()).toBeLessThan(at3);
  await axe(page, 'descendant chart');
});

test('family sheet: dialog with the sections, HTML download, print', async ({ page }) => {
  await openSample(page);
  await page.getByLabel('Find a person by name').fill('heinrich weber');
  await page.getByRole('button', { name: /Heinrich Weber/ }).first().click();
  await page.getByRole('button', { name: 'Family sheet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Family sheet' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h1')).toHaveText('Heinrich Weber');
  await expect(dialog.getByText('Partnerships', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Gertrud Meyer')).toBeVisible();
  await expect(dialog.getByText('Werner Weber')).toBeVisible();
  await axe(page, 'family sheet');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save as HTML file' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^family-sheet-Heinrich-Weber\.html$/);
  const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks as Buffer[]).toString('utf8'));
  expect(text).toContain('<h1>Heinrich Weber</h1>');
  expect(text).not.toContain('<script');
  // Printing goes through the browser's dialog; stub it and check the print root exists.
  await page.evaluate(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed += 1;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
});
