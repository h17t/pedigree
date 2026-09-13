/**
 * Renders the PWA icons from public/favicon.svg with the bundled Chromium (no image library
 * needed). Output: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png and
 * apple-touch-icon.png (180). The maskable icon keeps the mark inside the 80 % safe zone on a
 * solid green square. Run: node scripts/make-icons.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { existsSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const executablePath = process.env.PLAYWRIGHT_SANDBOX_CHROMIUM === '1' && existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
mkdirSync('public/icons', { recursive: true });

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });

async function render(file, size, maskable) {
  const inner = maskable ? Math.round(size * 0.62) : size;
  const pad = Math.round((size - inner) / 2);
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <div id="icon" style="width:${size}px;height:${size}px;background:${maskable ? '#1E6B5A' : 'transparent'};display:flex;align-items:center;justify-content:center">
      <div style="width:${inner}px;height:${inner}px;padding:${pad}px;box-sizing:content-box">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
    </div></body></html>`);
  await page.locator('#icon').screenshot({ path: file, omitBackground: !maskable });
  console.log(`${file} (${size}px)`);
}

await render('public/icons/icon-192.png', 192, false);
await render('public/icons/icon-512.png', 512, false);
await render('public/icons/icon-maskable-512.png', 512, true);
await render('public/icons/apple-touch-icon.png', 180, true);
await browser.close();
