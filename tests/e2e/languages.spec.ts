import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample } from './helpers';

async function axe(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), context).toEqual([]);
}

/** Each shipped language: its own name in the list, the page language, a translated heading, axe. */
const LANGS: { code: string; name: string; dataTitle: string; treeNav: string }[] = [
  { code: 'fr', name: 'Français', dataTitle: 'Données et réglages', treeNav: 'Arbre' },
  { code: 'es', name: 'Español', dataTitle: 'Datos y ajustes', treeNav: 'Árbol' },
  { code: 'it', name: 'Italiano', dataTitle: 'Dati e impostazioni', treeNav: 'Albero' },
  { code: 'pt', name: 'Português', dataTitle: 'Dados e definições', treeNav: 'Árvore' },
  { code: 'nl', name: 'Nederlands', dataTitle: 'Gegevens en instellingen', treeNav: 'Boom' },
  { code: 'pl', name: 'Polski', dataTitle: 'Dane i ustawienia', treeNav: 'Drzewo' },
  { code: 'ru', name: 'Русский', dataTitle: 'Данные и настройки', treeNav: 'Древо' },
  { code: 'tr', name: 'Türkçe', dataTitle: 'Veriler ve ayarlar', treeNav: 'Ağaç' },
];

test('every language can be chosen, translates the page and passes axe', async ({ page }) => {
  test.setTimeout(180_000);
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  // The label itself is translated after the first switch, so the select is addressed by id.
  const select = page.locator('#language-select');
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(['English', 'Deutsch', ...LANGS.map((l) => l.name)]);
  for (const lang of LANGS) {
    await select.selectOption(lang.code);
    await expect(page.locator('html')).toHaveAttribute('lang', lang.code);
    await expect(page.getByRole('heading', { name: lang.dataTitle })).toBeVisible();
    await expect(page.getByRole('button', { name: lang.treeNav, exact: true })).toBeVisible();
    await axe(page, `data page in ${lang.code}`);
  }
  // The choice survives a reload and Russian text renders in the Cyrillic chunk of the same family.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await page.locator('#language-select').selectOption('ru');
  await expect(page.getByRole('heading', { name: 'Данные и настройки' })).toBeVisible();
  const cyrillicLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    let found = false;
    document.fonts.forEach((f) => {
      if (f.family.replace(/"/g, '') === 'Atkinson Hyperlegible Next' && f.unicodeRange.includes('U+400-45F') && f.status === 'loaded') found = true;
    });
    return found;
  });
  expect(cyrillicLoaded).toBe(true);
  await page.getByRole('button', { name: 'Древо', exact: true }).click();
  await expect(page.getByRole('group', { name: /Холст семейного древа/ })).toBeVisible();
  await axe(page, 'canvas in ru');
});

test('dates typed in the chosen language are understood and shown in that language', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Language').selectOption('fr');
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await page.getByLabel('Trouver une personne par son nom').fill('karl weber');
  await page.getByRole('button', { name: /Karl Weber/ }).first().click();
  await page.getByRole('button', { name: 'Modifier', exact: true }).first().click();
  await page.locator('#pf-birth').fill('vers 14 mars 1878');
  await expect(page.getByText('Compris comme : vers (approximativement) 14 mars 1878')).toBeVisible();
  await page.locator('#pf-death').fill('entre 1944 et 1945');
  await expect(page.getByText('Compris comme : entre 1944 et 1945')).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByText('entre 1944 et 1945', { exact: false }).first()).toBeVisible();
});

test('the name order setting flips names on cards and lists', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Order of names').selectOption('surnameFirst');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Weber Karl/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.locator('.person-card', { hasText: 'Weber Karl' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByLabel('Order of names').selectOption('auto');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Karl Weber/ }).first()).toBeVisible();
});
