import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

/**
 * Performance pass with 500 people (stage j): CPU throttled 4× through the DevTools protocol
 * to approximate a mid-range phone. Numbers are written to test-results/perf-<project>.json
 * and the README quotes them; the assertions are generous ceilings that catch regressions.
 */
test('500 people: import, arrange, fit, zoom, list and timeline under 4× CPU throttling', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'CPU throttling needs the DevTools protocol');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const numbers: Record<string, number> = {};
  const time = async (label: string, fn: () => Promise<void>) => {
    const t0 = Date.now();
    await fn();
    numbers[label] = Date.now() - t0;
  };

  await page.goto('');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore a backup file' }).click();
  await (await chooser).setFiles('src/fixtures/perf-500.json');
  await time('open500ms', async () => {
    await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
    await expect(page.locator('.person-card').first()).toBeVisible();
  });

  await page.getByRole('button', { name: 'Layout' }).click();
  await time('arrangeMs', async () => {
    await page.getByRole('button', { name: 'Arrange the whole tree' }).click();
    await expect(page.getByText('The tree was arranged.')).toBeVisible();
  });
  await time('fitMs', async () => {
    await page.getByRole('button', { name: 'Fit' }).click();
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  });

  // Ten wheel-zoom steps: average time until the next frame is painted after each step.
  const canvas = page.getByRole('group', { name: /Family tree canvas/ });
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const frameTimes: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t0 = Date.now();
    await page.mouse.wheel(0, i % 2 ? 120 : -120);
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    frameTimes.push(Date.now() - t0);
  }
  numbers.zoomStepAvgMs = Math.round(frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length);
  numbers.zoomStepMaxMs = Math.max(...frameTimes);

  await time('listMs', async () => {
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
    await expect(page.getByText('500 people', { exact: true })).toBeVisible();
  });
  await time('timelineMs', async () => {
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  });
  await time('statisticsMs', async () => {
    await page.getByRole('button', { name: 'Statistics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  });

  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/perf-${testInfo.project.name}.json`, JSON.stringify({ people: 500, cpuThrottle: 4, viewport: page.viewportSize(), ...numbers }, null, 2));
  console.log(`perf ${testInfo.project.name}: ${JSON.stringify(numbers)}`);

  // Ceilings (throttled 4×): generous, to catch regressions rather than to certify speed.
  expect(numbers.open500ms).toBeLessThan(15_000);
  expect(numbers.arrangeMs).toBeLessThan(10_000);
  expect(numbers.zoomStepAvgMs).toBeLessThan(1_000);
  expect(numbers.listMs).toBeLessThan(10_000);
  expect(numbers.timelineMs).toBeLessThan(10_000);
});
