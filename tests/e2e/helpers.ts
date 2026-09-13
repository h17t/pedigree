import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Opens the app fresh and loads the sample family through the UI. */
export async function openSample(page: Page): Promise<void> {
  await page.goto('');
  await page.getByRole('button', { name: 'Look at the sample family' }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Family list' })).toBeVisible();
}

/** The page must never scroll horizontally (brief: no horizontal page scrolling on mobile). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth, 'document wider than the viewport').toBeLessThanOrEqual(clientWidth);
  const vw = page.viewportSize()?.width ?? 0;
  expect(clientWidth, 'layout viewport wider than the device (an element overflows)').toBeLessThanOrEqual(vw);
}
