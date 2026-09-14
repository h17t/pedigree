import { test, expect } from '@playwright/test';
import { openSample } from './helpers';

const base = process.env.VITE_BASE_PATH ?? '/pedigree/';

/** Offline and installability: the service worker precaches the build; data lives in localStorage. */
test('the web app manifest is served and derives start_url and scope from the base path', async ({ page, request }) => {
  await page.goto('');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).toString());
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as { start_url: string; scope: string; display: string; icons: { sizes: string; purpose?: string }[] };
  expect(manifest.start_url).toBe(base);
  expect(manifest.scope).toBe(base);
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
});

test('a tree opened once stays available offline, and an app update leaves localStorage untouched', async ({ page, context }) => {
  await openSample(page);
  // Wait for the service worker to control the page (precache complete).
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    return !!reg.active && !!navigator.serviceWorker.controller && keys.some((k) => k.includes('precache'));
  }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pedigree:')).sort());
  expect(before.length).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Friedrich Weber/ }).first()).toBeVisible();
  await expect(page.getByText('You are offline.')).toBeVisible();
  // The lazy views load from the cache too.
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await context.setOffline(false);

  // An update check (the same build: no change) and a reload keep every stored key.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });
  await page.reload();
  const after = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pedigree:')).sort());
  expect(after).toEqual(before);
});

test('the Data page explains installing and the update notice is not shown without an update', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Install on this device' })).toBeVisible();
  await expect(page.getByText(/Install app|Open the browser menu|tap the Share button/)).toBeVisible();
  await expect(page.getByText('A new version of Pedigree is ready')).toHaveCount(0);
});
