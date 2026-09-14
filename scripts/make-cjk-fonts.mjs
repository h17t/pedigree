/**
 * Copies the Noto Sans JP/KR/SC chunks (weights 400 and 700) from the fontsource packages into
 * public/fonts/cjk/, writes one stylesheet per family (loaded lazily by the app) and a JSON table
 * of chunks with their unicode ranges for the SVG export (public/fonts/cjk-chunks.json). Run: node scripts/make-cjk-fonts.mjs
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FAMILIES = [
  { key: 'jp', pkg: 'noto-sans-jp', family: 'Noto Sans JP' },
  { key: 'kr', pkg: 'noto-sans-kr', family: 'Noto Sans KR' },
  { key: 'sc', pkg: 'noto-sans-sc', family: 'Noto Sans SC' },
];
const WEIGHTS = [400, 700];
const OUT = 'public/fonts/cjk';
mkdirSync(OUT, { recursive: true });

const table = {};
for (const f of FAMILIES) {
  const dir = `node_modules/@fontsource/${f.pkg}`;
  const unicode = JSON.parse(readFileSync(join(dir, 'unicode.json'), 'utf8'));
  const rules = [];
  const chunks = [];
  for (const [key, range] of Object.entries(unicode)) {
    const m = key.match(/^\[(\d+)\]$/);
    if (!m) continue; // latin, latin-ext and vietnamese come from the main font
    const idx = m[1];
    for (const weight of WEIGHTS) {
      const src = join(dir, 'files', `${f.pkg}-${idx}-${weight}-normal.woff2`);
      const name = `${f.pkg}-${idx}-${weight}.woff2`;
      copyFileSync(src, join(OUT, name));
      const unicodeRange = range.split(',').join(', ');
      rules.push(`@font-face{font-family:'${f.family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('/fonts/cjk/${name}') format('woff2');unicode-range:${unicodeRange};}`);
      chunks.push({ weight, file: `fonts/cjk/${name}`, unicodeRange });
    }
  }
  writeFileSync(join('public/fonts', `cjk-${f.key}.css`), rules.join('\n') + '\n');
  table[f.key] = { family: f.family, chunks };
  console.log(`${f.family}: ${chunks.length} chunks, ${readdirSync(OUT).filter((n) => n.startsWith(f.pkg)).length} files`);
}
// Fetched by the SVG export only when the drawing contains East Asian text.
writeFileSync('public/fonts/cjk-chunks.json', JSON.stringify(table));
