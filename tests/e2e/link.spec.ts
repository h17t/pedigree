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

/** Select a person in the list view and, on phones, open the details sheet. */
async function selectInList(page: Page, query: string, name: RegExp) {
  await page.getByLabel('Find a person by name').fill(query);
  await page.getByRole('button', { name }).first().click();
  await page.waitForTimeout(200);
}

test('two existing people can be linked as partners with a stated kind; a second partnership is allowed; the same pair is refused', async ({ page }) => {
  await openSample(page);
  await selectInList(page, 'heinrich weber', /Heinrich Weber/);
  // Heinrich already has two partnerships; a third with an unrelated person is fine.
  await page.getByRole('group', { name: 'Add partner' }).getByRole('button', { name: 'Choose existing' }).click();
  await expect(page.getByRole('dialog', { name: 'Link a partner of Heinrich Weber' })).toBeVisible();
  await axe(page, 'link dialog');
  await page.getByLabel('Kind of relationship').selectOption('divorced');
  await page.getByLabel('Find the person by name').fill('lindner');
  await page.getByRole('button', { name: 'Link Johann Lindner', exact: true }).click();
  await expect(page.getByText('Linked Heinrich Weber and Johann Lindner.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Partnership with Johann Lindner' })).toBeVisible();
  // The family panel lists the new partnership as divorced, and the old ones are still there.
  await expect(page.getByRole('group', { name: 'Partnership with Johann Lindner' })).toContainText('divorced');
  await expect(page.getByRole('group', { name: 'Partnership with Gertrud Meyer' })).toBeVisible();
  // The same pair cannot be linked twice; the reason is shown instead of a button.
  await page.getByRole('group', { name: 'Add partner' }).getByRole('button', { name: 'Choose existing' }).click();
  await page.getByLabel('Find the person by name').fill('lindner');
  await expect(page.getByText(/Johann Lindner · already linked this way/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Link Johann Lindner', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  // One undo removes the link (on phones the details sheet covers the header first).
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  if (phone) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  if (phone) await page.getByRole('button', { name: /Heinrich Weber/ }).first().click();
  await expect(page.getByRole('group', { name: 'Partnership with Gertrud Meyer' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Partnership with Johann Lindner' })).toHaveCount(0);
});

test('an existing person can be linked as a child of a chosen family, with a relation; cycles are refused; the link can be removed', async ({ page }) => {
  await openSample(page);
  await selectInList(page, 'heinrich weber', /Heinrich Weber/);
  await page.getByRole('group', { name: 'Add child to the family with Gertrud Meyer' }).getByRole('button', { name: 'Choose existing' }).click();
  await expect(page.getByLabel('Which family?')).toHaveValue(/./);
  await page.getByLabel('Relationship to the parents').selectOption('adopted');
  // Heinrich's own parent cannot become his child.
  await page.getByLabel('Find the person by name').fill('karl weber');
  await expect(page.getByText(/Karl Weber · would make someone their own ancestor/)).toBeVisible();
  // An unrelated person can.
  await page.getByLabel('Find the person by name').fill('lindner');
  await page.getByRole('button', { name: 'Link Johann Lindner', exact: true }).click();
  await expect(page.getByText('Linked Heinrich Weber and Johann Lindner.')).toBeVisible();
  // The partnership editor lists the child with the relation and can remove the link again.
  // The family panel lists the child with the relation; the partnership editor can remove the link again.
  await expect(page.getByRole('group', { name: 'Partnership with Gertrud Meyer' })).toContainText('Johann Lindner (adopted)');
  await page.getByRole('group', { name: 'Partnership with Gertrud Meyer' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit partnership' })).toBeVisible();
  const row = page.locator('.link-row').filter({ hasText: 'Johann Lindner' });
  await expect(row.getByRole('combobox')).toHaveValue('adopted');
  await axe(page, 'partnership form with children');
  await row.getByRole('button', { name: 'Remove from this family' }).click();
  await expect(page.getByText('Removed Johann Lindner from the family.')).toBeVisible();
  await expect(page.locator('.link-row').filter({ hasText: 'Johann Lindner' })).toHaveCount(0);
});

test('an existing person can be linked as a parent; a person with two parents cannot take a third; the parent link can be removed', async ({ page }) => {
  await openSample(page);
  await selectInList(page, 'lindner', /Johann Lindner/);
  const father = page.getByRole('group', { name: 'Father', exact: true });
  const mother = page.getByRole('group', { name: 'Mother', exact: true });
  await expect(father).toContainText('not recorded');
  await father.getByRole('button', { name: 'Choose existing' }).click();
  await page.getByLabel('Find the person by name').fill('heinrich');
  await page.getByRole('button', { name: /Link Heinrich Weber/ }).click();
  await expect(page.getByText('Linked Johann Lindner and Heinrich Weber.')).toBeVisible();
  await expect(father).toContainText('Heinrich Weber');
  // A second parent joins the same family; nothing is assumed about their relationship.
  await mother.getByRole('button', { name: 'Choose existing' }).click();
  await page.getByLabel('Find the person by name').fill('gertrud');
  await page.getByRole('button', { name: /Link Gertrud Meyer/ }).click();
  await expect(mother).toContainText('Gertrud Meyer');
  await expect(page.getByRole('group', { name: "Parents' relationship" })).toContainText('not recorded');
  // Removing the father keeps the mother.
  await father.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(/is no longer recorded as a parent of Johann Lindner/)).toBeVisible();
  await expect(father).toContainText('not recorded');
  await expect(mother).toContainText('Gertrud Meyer');
});

test('a new partner is not assumed to be married, and the partnership editor says so', async ({ page }) => {
  await openSample(page);
  await selectInList(page, 'lindner', /Johann Lindner/);
  await page.getByRole('group', { name: 'Add partner' }).getByRole('button', { name: 'New person' }).click();
  await expect(page.getByRole('heading', { name: 'New person' })).toBeVisible();
  await page.getByLabel('Given names').fill('Neu');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: /^Neu/ })).toBeVisible();
  // The new partner is now selected; their family panel shows the partnership with Johann as not recorded.
  await expect(page.getByRole('group', { name: 'Partnership with Johann Lindner' })).toContainText('not recorded');
});
