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
  await page.getByRole('button', { name: /Karl Weber/ }).first().click();
  await page.waitForTimeout(300);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-list-details.png`, fullPage: w >= 1024 });
  if (w < 1024) {
    await page.getByRole('button', { name: 'Back' }).click();
    await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-list.png`, fullPage: false });
  }
  await page.getByRole('button', { name: 'Data' }).click();
  await page.waitForTimeout(300);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${w}-data.png`, fullPage: true });
});
