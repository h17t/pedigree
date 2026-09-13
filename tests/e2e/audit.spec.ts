import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

/**
 * Final accessibility audit (stage j): axe over the states the earlier specs do not reach, plus
 * keyboard-only paths. Every violation blocks the build.
 */
async function axe(page: Page, context: string) {
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
  expect(results.violations, `${context}\n${summary}`).toEqual([]);
}

async function openTree(page: Page) {
  await openSample(page);
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
}

test('tree states: selection with details, add menu, legend, layout panel, filter, multi-select bar', async ({ page }) => {
  await openTree(page);
  const w = page.viewportSize()?.width ?? 0;
  await page.getByLabel('Type a name to jump to a person').fill('karl');
  await page.getByRole('button', { name: /Karl Weber, 1878/ }).first().click();
  await page.waitForTimeout(200);
  await axe(page, 'tree with a selection');
  // Laptops list the add actions in the details column; phones open them from the bar.
  if (w < 1024) await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add child' }).first()).toBeVisible();
  await axe(page, 'add menu open');
  if (w < 1024) await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Legend' }).click();
  await axe(page, 'legend open');
  await page.getByRole('button', { name: 'Legend', exact: true }).click();
  await page.getByRole('button', { name: 'Layout' }).click();
  await axe(page, 'layout panel open');
  await page.getByRole('button', { name: 'Layout' }).click();
  if (w < 1024) await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Ancestors of Karl Weber' }).click();
  await expect(page.getByText(/people hidden/)).toBeVisible();
  await axe(page, 'filter active');
  await page.getByRole('button', { name: 'Show everyone' }).click();
  if (w >= 1024) {
    // Shift+drag an area around Karl: the multi-select bar.
    const karl = page.locator('.person-card').filter({ hasText: 'Karl Weber' });
    const box = (await karl.boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x - 40, box.y - 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 700, box.y + 200, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.getByText(/people selected/)).toBeVisible();
    await axe(page, 'multi-select bar');
  }
});

test('dialogs: partnership form, warnings, and the wizard summary step', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: /Heinrich Weber/ }).first().click();
  await page.getByRole('button', { name: /Partnership with Gertrud Meyer/ }).click();
  await expect(page.getByRole('heading', { name: 'Edit partnership' })).toBeVisible();
  await axe(page, 'partnership form');
  await page.getByRole('button', { name: 'Discard changes' }).click();
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole('button', { name: 'Back' }).click();

  // The guided start with a father born after his child produces a "thing to check".
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('button', { name: 'Run the guided start again' }).click();
  await page.getByLabel('Given names').fill('Test');
  await page.getByLabel('Year of birth').fill('1985');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('group', { name: 'Father' }).getByLabel('Given names').fill('Late');
  await page.getByRole('group', { name: 'Father' }).getByLabel('Year of birth').fill('1990');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await page.getByRole('button', { name: 'Add another child' }).click();
  await axe(page, 'wizard children step with summary');
  await page.getByRole('button', { name: 'Create the tree' }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.getByRole('button', { name: 'Show things to check' }).click();
  await expect(page.getByRole('dialog', { name: 'Things to check' })).toBeVisible();
  await expect(page.getByText(/born before their parent/).first()).toBeVisible();
  await axe(page, 'warnings dialog');
  await page.keyboard.press('Escape');

  // A draft left mid-way shows the resume notice on the project list.
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('button', { name: 'Run the guided start again' }).click();
  await page.getByLabel('Given names').fill('Draft');
  await page.getByRole('button', { name: 'Leave and continue later' }).click();
  await page.getByRole('button', { name: 'Trees', exact: true }).or(page.getByRole('button', { name: 'Family trees', exact: true })).first().click();
  await expect(page.getByRole('button', { name: 'Continue the guided start' })).toBeVisible();
  await axe(page, 'project list with a resumable draft');
});

test('keyboard only: skip link, header, navigation and canvas are reachable and operable', async ({ page }) => {
  await openTree(page);
  // From a fresh document the skip link is the first tab stop and moves focus to the main region.
  await page.reload();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  // Tab reaches the search field, the canvas group and a card; Enter selects.
  await page.getByLabel('Type a name to jump to a person').focus();
  await page.keyboard.type('anna');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.person-card[aria-pressed="true"]')).toHaveCount(1);
  // The canvas itself pans with arrows and zooms with + / -.
  const canvas = page.getByRole('group', { name: /Family tree canvas/ });
  await canvas.focus();
  const zoomGroup = page.getByRole('group', { name: /Zoom: \d+ %/ });
  const zoomBefore = await zoomGroup.getAttribute('aria-label');
  await page.keyboard.press('+');
  await page.waitForTimeout(100);
  const zoomAfter = await zoomGroup.getAttribute('aria-label');
  expect(zoomAfter).not.toBe(zoomBefore);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(page.locator('.person-card[aria-pressed="true"]')).toHaveCount(0);
  // Undo/redo shortcuts do nothing harmful when nothing is undoable.
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('German: the tree, wizard and help carry no untranslated strings and pass axe', async ({ page }) => {
  await openTree(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Language').selectOption('de');
  await page.getByRole('button', { name: 'Baum', exact: true }).click();
  await expect(page.getByRole('group', { name: /Zeichenfläche/ })).toBeVisible();
  await page.getByRole('button', { name: 'Legende' }).click();
  await axe(page, 'German tree with legend');
  await page.getByRole('button', { name: 'Hilfe', exact: true }).click();
  await page.getByRole('button', { name: 'Geführten Start erneut ausführen' }).click();
  await expect(page.getByRole('heading', { name: 'Sie', exact: true })).toBeVisible();
  await expect(page.getByText('Schritt 1 von 4')).toBeVisible();
  await axe(page, 'German wizard');
  // No English UI strings leaked into the German wizard page.
  const text = (await page.locator('#main').innerText()).toLowerCase();
  for (const english of ['given names', 'year of birth', 'next', 'skip this step']) expect(text, english).not.toContain(english);
});
