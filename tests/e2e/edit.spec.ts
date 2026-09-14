import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

async function axe(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), context).toEqual([]);
}
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

/** Select Karl Weber in the list view (works on both layouts). */
async function selectKarl(page: Page) {
  await page.getByLabel('Find a person by name').fill('karl weber');
  await page.getByRole('button', { name: /Karl Weber/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Karl Weber' })).toBeVisible();
}

test('add a child through the add menu, edit the name, save, then undo', async ({ page }) => {
  await openSample(page);
  await selectKarl(page);
  await page.getByRole('group', { name: /Add child to the family with/ }).getByRole('button', { name: 'New person' }).click();
  await expect(page.getByRole('heading', { name: 'New person' })).toBeVisible();
  await axe(page, 'person form');
  await expect(page.getByLabel('Surname')).toHaveValue('Weber');
  await page.getByLabel('Given names').fill('Emil');
  await page.locator('#pf-birth').fill('02/03/1923');
  await expect(page.getByText('Understood as: 2 March 1923')).toBeVisible();
  await page.getByRole('button', { name: 'Read as 3 February 1923 instead' }).click();
  await expect(page.getByText('Understood as: 3 February 1923')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Emil Weber' })).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Find a person by name').fill('');
  await expect(page.getByText('49 people')).toBeVisible();
  // Undo the edit and the creation with the visible button
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('48 people')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('delete shows the impact and can be undone; a death date forces deceased', async ({ page }) => {
  await openSample(page);
  await page.getByLabel('Find a person by name').fill('heinrich weber');
  await page.getByRole('button', { name: /Heinrich Weber/ }).first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete Heinrich Weber?' })).toBeVisible();
  await expect(page.getByText('The partnership with Gertrud Meyer stays, with 2 people.')).toBeVisible();
  await expect(page.getByText('The partnership with Hilde Weber stays, with 2 people.')).toBeVisible();
  await axe(page, 'delete dialog');
  await page.getByRole('button', { name: 'Delete Heinrich Weber' }).click();
  await expect(page.getByText('Deleted Heinrich Weber.')).toBeVisible();
  await page.getByLabel('Find a person by name').fill('heinrich weber');
  await expect(page.getByText('No one matches "heinrich weber".')).toBeVisible();
  // The children of both marriages are still there.
  await page.getByLabel('Find a person by name').fill('werner weber');
  await expect(page.getByText('1 match')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByLabel('Find a person by name').fill('heinrich weber');
  await expect(page.getByText('1 match')).toBeVisible();
  // Life status rule
  await selectKarl(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.getByLabel('Living or deceased')).toBeDisabled();
  await expect(page.getByText('This person has a date of death, so they are recorded as deceased.')).toBeVisible();
});

test('possible duplicates are listed and merging re-points relationships', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Add person' }).click();
  await page.getByLabel('Given names').fill('Carl');
  await page.getByLabel('Surname').fill('Weber');
  await page.locator('#pf-birth').fill('1878');
  await page.getByRole('button', { name: 'Save changes' }).click();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByText(/Carl Weber \(1878\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Compare and merge' }).click();
  await expect(page.getByRole('dialog', { name: 'Merge two people' })).toBeVisible();
  await axe(page, 'merge dialog');
  await page.getByRole('radio', { name: 'Karl' }).check();
  await page.getByRole('button', { name: 'Merge these two people' }).click();
  await expect(page.getByText(/Merged (Carl|Karl) Weber into (Karl|Carl) Weber\./)).toBeVisible();
  await expect(page.getByText('No possible duplicates found.')).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByLabel('Find a person by name').fill('karl weber');
  await expect(page.getByText('1 match')).toBeVisible();
  await page.getByRole('button', { name: /Karl Weber/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Karl Weber' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anna Weber' }).first()).toBeVisible();
});

test.describe('desktop', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'mouse only');
  test('shift-drag selects several cards and Delete removes them as one step', async ({ page }) => {
    await openSample(page);
    await page.getByRole('button', { name: 'Tree', exact: true }).click();
    await page.getByLabel('Type a name to jump to a person').fill('lindner');
    await page.getByRole('button', { name: /Johann Lindner/ }).first().click();
    await page.waitForTimeout(200);
    const johann = page.locator('.person-card').filter({ hasText: 'Johann Lindner' });
    const box = (await johann.boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x - 40, box.y - 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 700, box.y + 200, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    const bar = page.getByText(/people selected/);
    await expect(bar).toBeVisible();
    const n = Number((await bar.textContent())!.match(/(\d+) people/)![1]);
    expect(n).toBeGreaterThanOrEqual(2);
    await page.getByRole('button', { name: /Delete \d+ selected people/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Delete \d+ selected people/ }).click();
    await expect(page.locator('.person-card')).toHaveCount(48 - n);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.person-card')).toHaveCount(48);
  });
});
