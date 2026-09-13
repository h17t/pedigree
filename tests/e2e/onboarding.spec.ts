import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectNoViolations(page: Page, context: string) {
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
  expect(results.violations, `${context}\n${summary}`).toEqual([]);
}

async function fillPerson(page: Page, legend: string | null, given: string, surname: string, year: string) {
  const scope = legend ? page.getByRole('group', { name: legend }) : page.locator('form');
  await scope.getByLabel('Given names').fill(given);
  await scope.getByLabel('Surname').fill(surname);
  await scope.getByLabel('Year of birth').fill(year);
}

test('first-run screen offers the guided start and has no accessibility violations', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start with yourself' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Look at the sample family' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start an empty tree' })).toBeVisible();
  await expectNoViolations(page, 'first run');
});

test('the guided start creates the family as one undo step and lands on the canvas with a hint', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Start with yourself' }).click();
  await expect(page.getByRole('heading', { name: 'You' })).toBeVisible();
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await expectNoViolations(page, 'wizard step 1');

  // The first step needs a name.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toContainText('at least your given names');
  await fillPerson(page, null, 'Anna', 'Muster', '1985');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Your parents' })).toBeVisible();
  await fillPerson(page, 'Father', 'Peter', 'Muster', '1955');
  await page.getByRole('group', { name: 'Father' }).getByLabel('Living or deceased').selectOption('deceased');
  await page.getByRole('group', { name: 'Father' }).getByLabel('Year of death').fill('2010');
  await fillPerson(page, 'Mother', 'Maria', 'Muster', '1958');
  // Nothing is assumed about the parents' relationship; here it is stated.
  await expect(page.getByLabel("Your parents' relationship")).toHaveValue('unknown');
  await page.getByLabel("Your parents' relationship").selectOption('divorced');
  await expectNoViolations(page, 'wizard step 2');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Your partner' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip this step' }).click();

  await expect(page.getByRole('heading', { name: 'Your children' })).toBeVisible();
  await page.getByRole('button', { name: 'Add another child' }).click();
  await fillPerson(page, 'Child 1', 'Lena', 'Muster', '2012');
  await expect(page.getByText('4 people and 2 partnerships')).toBeVisible();
  await expectNoViolations(page, 'wizard step 4');
  await page.getByRole('button', { name: 'Create the tree' }).click();

  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await expect(page.getByText('Your tree was created with 4 people.')).toBeVisible();
  await expect(page.getByRole('note', { name: 'Tip' })).toContainText('Next: add grandparents');
  // The wizard result is laid out (no provisional outlines) and "you" is selected.
  await expect(page.getByRole('button', { name: /Anna Muster/ }).first()).toBeVisible();
  // The father is deceased with his year, the mother's status is not known, the parents are divorced.
  await expect(page.getByRole('button', { name: /Peter Muster, 1955 – † 2010/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: /Peter Muster/ }).first().click();
  await expect(page.getByText(/divorced/).first()).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();

  // One undo step removes everyone; redo brings them back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('This tree has no people yet')).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('button', { name: /Lena Muster/ }).first()).toBeVisible();

  // Dismissing the hint is remembered across a reload.
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('note', { name: 'Tip' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByRole('note', { name: 'Tip' }).filter({ hasText: 'grandparents' })).toHaveCount(0);
});

test('a wizard left mid-way can be resumed from the family trees page', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Start with yourself' }).click();
  await fillPerson(page, null, 'Otto', 'Beispiel', '1970');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Your parents' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave and continue later' }).click();
  await expect(page.getByRole('heading', { name: 'Your family trees' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue the guided start' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue the guided start' }).click();
  await expect(page.getByRole('heading', { name: 'Your parents' })).toBeVisible();
  // A reload mid-way reopens the wizard at the same step with the draft intact.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your parents' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave and continue later' }).click();
  // Returning later lands on the (still empty) tree, whose empty state resumes the draft.
  await page.reload();
  await expect(page.getByText('This tree has no people yet')).toBeVisible();
  await page.getByRole('button', { name: 'Start with yourself' }).click();
  await expect(page.getByRole('heading', { name: 'Your parents' })).toBeVisible();
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Given names')).toHaveValue('Otto');
});

test('help page is reachable before and after a tree exists, in both languages', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Help and quick start' }).click();
  await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick start' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print this quick start' })).toBeVisible();
  await expectNoViolations(page, 'help without a tree');
  await page.getByRole('button', { name: 'Back to the family trees' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

  await page.getByRole('button', { name: 'Look at the sample family' }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reading the lines' })).toBeVisible();
  await expectNoViolations(page, 'help with a tree');

  await page.getByRole('button', { name: 'Show the tips again' }).click();
  await expect(page.getByText('The tips will be shown again.')).toBeVisible();

  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Language').selectOption('de');
  await page.getByRole('button', { name: 'Hilfe', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Schnellstart' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Die Linien lesen' })).toBeVisible();
  await expectNoViolations(page, 'German help');
  await page.getByRole('button', { name: 'Zurück zum Baum' }).click();
  await expect(page.getByRole('group', { name: /Zeichenfläche/ })).toBeVisible();
});

test('the guided start can be run again from the help page into the open tree', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Start an empty tree' }).click();
  await expect(page.getByText('This tree has no people yet')).toBeVisible();
  await page.getByRole('button', { name: 'Start with yourself' }).click();
  await expect(page.getByRole('heading', { name: 'You' })).toBeVisible();
  await fillPerson(page, null, 'Solo', 'Person', '');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await expect(page.getByText('1 person and 0 partnerships')).toBeVisible();
  await page.getByRole('button', { name: 'Create the tree' }).click();
  await expect(page.getByText('Your tree was created with 1 person.')).toBeVisible();
});
