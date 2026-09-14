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

test('search across all fields with filters, results list and "show only these" on the canvas', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await page.getByRole('button', { name: 'Search & filter' }).click();
  await expect(page.getByRole('region', { name: 'Search and filter' })).toBeVisible();
  await axe(page, 'search panel');
  await page.getByLabel(/Words to find/).fill('winzer');
  await expect(page.getByText(/people found|person found/)).toBeVisible();
  const before = await page.locator('.person-card').count();
  await page.getByRole('button', { name: 'Show only these on the canvas' }).click();
  await expect(page.getByText(/Showing: Search results/)).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.locator('.person-card').count()).toBeLessThan(before);
  await page.getByRole('button', { name: 'Show everyone' }).click();
  await page.waitForTimeout(300);
  expect(await page.locator('.person-card').count()).toBe(before);
  // A completeness filter on its own.
  await page.getByRole('button', { name: 'Search & filter' }).click();
  await page.getByLabel('No parents recorded').check();
  await expect(page.getByText(/people found/)).toBeVisible();
  await page.getByRole('button', { name: 'Close search' }).click();
});

test('colour groups: created on the Data page, assigned in the editor, shown on the card and in the legend', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Colour groups' })).toBeVisible();
  // The sample's branch tags were migrated into groups.
  const rows = page.locator('.group-row');
  const migrated = await rows.count();
  expect(migrated).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Add group' }).click();
  await expect(rows).toHaveCount(migrated + 1);
  const nameField = rows.nth(migrated).getByLabel('Name');
  await nameField.fill('Auswanderer');
  await rows.nth(migrated).getByLabel('Colour').selectOption('red');
  await axe(page, 'groups panel');
  // Assign it to a person.
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByLabel('Find a person by name').fill('lindner');
  await page.getByRole('button', { name: /Johann Lindner/ }).first().click();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Colour group').selectOption({ label: 'Auswanderer' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Auswanderer', { exact: true }).first()).toBeVisible();
  // The card carries the stripe with the name, and the legend lists the group.
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.locator('.person-card').filter({ hasText: 'Johann Lindner' }).first()).toContainText('Auswanderer');
  await page.getByRole('button', { name: 'Legend', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Legend' }).getByText('Auswanderer')).toBeVisible();
  // Removing the group takes people out of it.
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.locator('.group-row').filter({ hasText: 'Auswanderer' }).getByRole('button', { name: 'Remove group' }).click();
  await expect(page.getByText(/The group "Auswanderer" was removed/)).toBeVisible();
});

test('relationship calculator gives a plain-language answer', async ({ page }) => {
  await openSample(page);
  await page.getByLabel('Find a person by name').fill('heinrich weber');
  await page.getByRole('button', { name: /Heinrich Weber/ }).first().click();
  await page.getByRole('button', { name: /How is this person related/ }).click();
  const dialog = page.getByRole('dialog', { name: /Relationship of Heinrich Weber/ });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Choose the other person by name').fill('karl weber');
  await dialog.getByRole('button', { name: /Karl Weber/ }).first().click();
  await expect(dialog.getByRole('status')).toContainText(/is the (father|grandfather|great-grandfather) of Heinrich Weber/);
  await axe(page, 'relationship dialog');
  await dialog.getByLabel('Choose the other person by name').fill('werner weber');
  await dialog.getByRole('button', { name: /Werner Weber/ }).first().click();
  await expect(dialog.getByRole('status')).toContainText(/Werner Weber is the son of Heinrich Weber/);
});
