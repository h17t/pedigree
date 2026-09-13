import { test, expect } from '@playwright/test';
import { openSample } from './helpers';

/**
 * Two tabs on the same project: the first holds the edit lock, the second is read-only and
 * can take over; the first then drops to read-only and offers to reload.
 */
test('second tab is read-only, take-over hands the lock over', async ({ context, page }) => {
  await openSample(page);
  await expect(page.getByText('Read-only: another tab is editing')).toHaveCount(0);

  const second = await context.newPage();
  await second.goto('');
  await expect(second.getByRole('heading', { name: 'Family list' })).toBeVisible();
  await expect(second.getByText('Read-only: another tab is editing')).toBeVisible();
  await expect(second.getByText('This family tree is open for editing in another tab')).toBeVisible();

  await second.getByRole('button', { name: 'Take over editing here' }).click();
  await expect(second.getByText('Read-only: another tab is editing')).toHaveCount(0);

  await expect(page.getByText('Another tab has taken over editing')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload the newer version' })).toBeVisible();

  await page.getByRole('button', { name: 'Take over editing here' }).click();
  await expect(page.getByText('Another tab has taken over editing')).toHaveCount(0);
  await expect(second.getByText('Another tab has taken over editing')).toBeVisible();
});

test('closing the owning tab releases the lock for a new tab', async ({ context, page }) => {
  await openSample(page);
  await page.close();
  const fresh = await context.newPage();
  await fresh.goto('');
  await expect(fresh.getByRole('heading', { name: 'Family list' })).toBeVisible();
  await expect(fresh.getByText('Read-only: another tab is editing')).toHaveCount(0);
});

test('corrupt stored data shows the recovery screen and keeps the payload', async ({ page }) => {
  await openSample(page);
  const id = await page.evaluate(() => (JSON.parse(localStorage.getItem('pedigree:settings')!) as { lastOpenProjectId: string }).lastOpenProjectId);
  await page.evaluate((pid) => localStorage.setItem(`pedigree:project:${pid}`, '{"broken":'), id);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The saved data could not be read' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download the raw data' })).toBeEnabled();
  const kept = await page.evaluate((pid) => localStorage.getItem(`pedigree:project:${pid}`), id);
  expect(kept).toBe('{"broken":');
  const recovery = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pedigree:recovery:')));
  expect(recovery).toHaveLength(1);
});

test('no network requests after the initial load', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== '127.0.0.1') external.push(r.url());
  });
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.waitForTimeout(500);
  expect(external).toEqual([]);
});
