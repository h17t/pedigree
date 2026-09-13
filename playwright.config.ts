import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const base = process.env.VITE_BASE_PATH ?? '/pedigree/';
const port = 4173;

// The remote development sandbox ships a pinned Chromium that may not match the Playwright
// version; use it when present so tests run without downloading a browser. CI installs
// the matching browser with `npx playwright install --with-deps chromium`.
const sandboxChromium = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PLAYWRIGHT_SANDBOX_CHROMIUM === '1' && existsSync(sandboxChromium) ? sandboxChromium : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}${base}`,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
