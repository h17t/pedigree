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
  { code: 'ja', name: '日本語', dataTitle: 'データと設定', treeNav: '系図' },
  { code: 'zh', name: '中文（简体）', dataTitle: '数据与设置', treeNav: '家谱' },
  { code: 'ko', name: '한국어', dataTitle: '데이터 및 설정', treeNav: '가계도' },
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
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
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

test('Japanese, Chinese and Korean load their fonts lazily and put the surname first', async ({ page }) => {
  await openSample(page);
  // No East Asian stylesheet before the language or the data asks for one.
  expect(await page.locator('link[id^="cjk-font-"]').count()).toBe(0);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.locator('#language-select').selectOption('ja');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('link#cjk-font-jp')).toHaveAttribute('href', /fonts\/cjk-jp\.css$/);
  await expect(page.getByRole('heading', { name: 'データと設定' })).toBeVisible();
  await page.getByRole('button', { name: '一覧', exact: true }).click();
  // Latin names read surname first in Japanese by default.
  await expect(page.getByRole('button', { name: /^Weber Karl/ }).first()).toBeVisible();
  // A Japanese name joins without a space, is measured full-width and exports with a Noto chunk.
  await page.getByRole('button', { name: '人物を追加' }).click();
  await page.getByLabel('名', { exact: true }).fill('太郎');
  await page.getByLabel('姓', { exact: true }).fill('山田');
  await page.locator('#pf-birth').fill('1923年3月14日');
  await expect(page.getByText('解釈: 1923年3月14日')).toBeVisible();
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(page.getByRole('heading', { name: '山田太郎' })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole('button', { name: '戻る' }).click();
  await page.getByRole('button', { name: '系図', exact: true }).click();
  await expect(page.locator('.person-card', { hasText: '山田太郎' })).toHaveCount(1);
  await page.getByRole('button', { name: '印刷と書き出し' }).click();
  const dialog = page.getByRole('dialog', { name: '印刷と書き出し' });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'SVG ファイルを保存' }).click();
  const svg = (await import('node:fs')).readFileSync((await (await download).path()), 'utf8');
  expect(svg).toContain('font-family:"Noto Sans JP"');
  expect(svg).toContain('山田太郎');
  expect(svg).toMatch(/font-family='"?Atkinson Hyperlegible Next"?, "?Noto Sans JP/);
  await page.keyboard.press('Escape');
  // Korean and Chinese bring their own family; the choice of name order can be overridden.
  await page.getByRole('button', { name: 'データ', exact: true }).click();
  await page.locator('#language-select').selectOption('ko');
  await expect(page.locator('link#cjk-font-kr')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '데이터 및 설정' })).toBeVisible();
  await page.locator('#nameorder-select').selectOption('givenFirst');
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Karl Weber/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^太郎山田/ }).first()).toBeVisible();
  await page.getByRole('button', { name: '데이터', exact: true }).click();
  await page.locator('#language-select').selectOption('zh');
  await expect(page.locator('link#cjk-font-sc')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '数据与设置' })).toBeVisible();
  await axe(page, 'data in zh');
});
