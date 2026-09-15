/**
 * The PDF export embeds fonts, and a PDF can read neither WOFF2 nor the CSS the app loads; it
 * needs the plain WOFF of each chunk. Those copies are large in total (about 18 MB) and identical
 * to what the fontsource packages already hold, so they are not kept in the repository: this
 * script puts them beside the WOFF2 chunks before a build. Run by `prebuild`; files already there
 * are left alone, so only the first build pays for it.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FAMILIES = [
  { pkg: 'noto-sans-jp' },
  { pkg: 'noto-sans-kr' },
  { pkg: 'noto-sans-sc' },
];
const WEIGHTS = [400, 700];
const OUT = 'public/fonts/cjk';
mkdirSync(OUT, { recursive: true });

let copied = 0, present = 0;
for (const { pkg } of FAMILIES) {
  const dir = `node_modules/@fontsource/${pkg}`;
  if (!existsSync(dir)) {
    console.error(`${pkg} is not installed; run npm ci first.`);
    process.exit(1);
  }
  const unicode = JSON.parse(readFileSync(join(dir, 'unicode.json'), 'utf8'));
  for (const key of Object.keys(unicode)) {
    const m = /^\[(\d+)\]$/.exec(key);
    if (!m) continue; // latin, latin-ext and vietnamese come from the main font
    for (const weight of WEIGHTS) {
      const to = join(OUT, `${pkg}-${m[1]}-${weight}.woff`);
      if (existsSync(to)) {
        present += 1;
        continue;
      }
      copyFileSync(join(dir, 'files', `${pkg}-${m[1]}-${weight}-normal.woff`), to);
      copied += 1;
    }
  }
}
console.log(`East Asian WOFF chunks for the PDF export: ${copied} copied, ${present} already there.`);
