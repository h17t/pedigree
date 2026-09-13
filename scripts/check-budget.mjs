/**
 * Bundle budget check. Reads Vite's build manifest, gzips each asset and sums
 *  - "initial JS": the entry chunk plus every chunk it imports statically
 *  - "initial payload": initial JS + index.html + the CSS of those chunks + the fonts that
 *    index.html preloads (the two Latin weights loaded at startup)
 * Fails the build when either exceeds the budget. Prints a Markdown table for the README.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = 'dist';
const BUDGET_JS = 250 * 1024;
const BUDGET_TOTAL = 500 * 1024;

const manifestPath = join(DIST, '.vite', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}. Run "npm run build" first.`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const gz = (rel) => gzipSync(readFileSync(join(DIST, rel))).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const entry = Object.values(manifest).find((m) => m.isEntry);
if (!entry) {
  console.error('No entry chunk in manifest.');
  process.exit(1);
}

// Walk static imports transitively.
const initial = new Map();
const css = new Map();
const visit = (key) => {
  const m = manifest[key];
  if (!m || initial.has(m.file)) return;
  initial.set(m.file, gz(m.file));
  for (const c of m.css ?? []) if (!css.has(c)) css.set(c, gz(c));
  for (const dep of m.imports ?? []) visit(dep);
};
visit(Object.keys(manifest).find((k) => manifest[k] === entry));

const lazy = Object.values(manifest)
  .filter((m) => !initial.has(m.file) && m.file.endsWith('.js'))
  .map((m) => [m.file, gz(m.file)]);

const html = gz('index.html');
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const fontFiles = readdirSync(join(DIST, 'fonts')).filter((f) => f.endsWith('.woff2'));
const preloaded = fontFiles.filter((f) => indexHtml.includes(f)).map((f) => [`fonts/${f}`, gz(`fonts/${f}`)]);

const initialJs = [...initial.values()].reduce((a, b) => a + b, 0);
const cssTotal = [...css.values()].reduce((a, b) => a + b, 0);
const fontsTotal = preloaded.reduce((a, [, n]) => a + n, 0);
const total = initialJs + cssTotal + html + fontsTotal;

const rows = [
  ['Initial JS (entry + static imports)', initialJs, BUDGET_JS],
  ['Initial CSS', cssTotal, null],
  ['index.html', html, null],
  ['Fonts loaded at startup', fontsTotal, null],
  ['**Initial payload**', total, BUDGET_TOTAL],
];
console.log('\n| Asset group | gzipped | budget |');
console.log('|---|---|---|');
for (const [label, n, b] of rows) console.log(`| ${label} | ${kb(n)} | ${b ? kb(b) : '—'} |`);
console.log('\nInitial chunks:');
for (const [f, n] of initial) console.log(`  ${f.padEnd(48)} ${kb(n)}`);
if (lazy.length) {
  console.log('Lazy chunks (not counted):');
  for (const [f, n] of lazy) console.log(`  ${f.padEnd(48)} ${kb(n)}`);
}

let failed = false;
if (initialJs > BUDGET_JS) {
  console.error(`\nFAIL: initial JS ${kb(initialJs)} exceeds budget ${kb(BUDGET_JS)}`);
  failed = true;
}
if (total > BUDGET_TOTAL) {
  console.error(`\nFAIL: initial payload ${kb(total)} exceeds budget ${kb(BUDGET_TOTAL)}`);
  failed = true;
}
if (failed) process.exit(1);
console.log('\nBudget OK.');
