import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openSample, expectNoHorizontalScroll } from './helpers';

/** Stage screenshots at 360×640 (phone project) and 1440×900 (desktop project). */
const dir = 'test-results/screenshots';
mkdirSync(dir, { recursive: true });

test('stage screenshots', async ({ page }, testInfo) => {
  const w = page.viewportSize()?.width ?? 0;
  await page.goto('');
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-projects.png`, fullPage: true });
  await openSample(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await page.waitForTimeout(400);
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Arrange the whole tree' }).click();
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Fit' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-tree-fit.png`, fullPage: false });
  await page.getByLabel('Type a name to jump to a person').fill('karl');
  await page.getByRole('button', { name: /Karl Weber, 1878/ }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-tree.png`, fullPage: false });
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: /Karl Weber/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.waitForTimeout(200);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-edit-form.png`, fullPage: w >= 1024 });
  await page.getByRole('button', { name: w >= 1024 ? 'Discard changes' : 'Back' }).click();
  await page.waitForTimeout(200);
  await page.waitForTimeout(300);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-list-details.png`, fullPage: w >= 1024 });
  if (w < 1024) {
    await page.getByRole('button', { name: 'Back' }).click();
    await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-list.png`, fullPage: false });
  }
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.waitForTimeout(400);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-timeline.png`, fullPage: false });
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await page.waitForTimeout(400);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-statistics.png`, fullPage: true });
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.waitForTimeout(300);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-data.png`, fullPage: true });
});
