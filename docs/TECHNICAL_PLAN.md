# Technical plan

Status: **approved 2026-09-13**. Nothing in this document is implemented yet; the answers to the **ASK** items are recorded in `DECISIONS.md` (items 33–54).
Open questions for you are marked **ASK**. Assumptions I made are marked **ASSUMED** and
are also listed in `DECISIONS.md`.

## 1. Stack and library choices

| Concern | Choice | Why |
|---|---|---|
| Framework | React 19 + TypeScript 5 (strict) + Vite 7 | As briefed. Vite 7 needs Node ≥ 20.19, which current Node 20 LTS satisfies. CI pins Node 20. |
| Package manager | npm, committed `package-lock.json` | As briefed. |
| State | Zustand (≈1 KB) holding a normalized `Project`, plus a custom undo stack built on Immer `produceWithPatches` | Zustand gives selector-based subscriptions, so a drag frame re-renders one card, not all 500. It has no action/reducer boilerplate. Immer patches make each undo step a few bytes instead of a full copy of the tree. A custom reducer store would need its own subscription layer; Redux adds nothing we need. |
| Immutability / undo | `immer` (`produceWithPatches`, `applyPatches`) | Brief requires patch-based undo. Every mutation goes through `store.transact(label, draft => …)`; bulk operations wrap many edits in one `transact`, so they are one undo step by construction. |
| Routing | None (no router library) | The app has four modes and a few dialogs. Mode and selected project live in the store and are mirrored to the URL hash (`#/tree`, `#/data`) so the browser back button and PWA `start_url` behave. A router would cost bytes for nothing. |
| Styling | Plain CSS with custom properties from `src/design/tokens.ts`, CSS Modules for components | No runtime CSS-in-JS; tokens exist once in TS and are emitted as `:root` variables so SVG export and print use the same values. |
| SVG rendering | Hand-written React SVG components | No D3 (bundle) and no `react-zoom-pan-pinch` (it manipulates CSS transforms; we need a `viewBox` we control for print). Pan/zoom is ~150 lines. |
| Layout algorithm | Custom generational layout (`src/render/layout/`) | ELK is ≈1 MB, dagre is unmaintained and does not model unions. A layered layout with union nodes as junctions is small and lets the tests assert exact positions. |
| Charts | Custom SVG bars/histograms | Brief: no heavy charting suite. Every chart is a component with a text label per bar and a data table twin. |
| i18n | Hand-rolled typed dictionary (`src/i18n/`), `Intl.PluralRules`, `Intl.DateTimeFormat`, `Intl.NumberFormat` | As briefed. `t(key, params)` where `key` is a template-literal type derived from the `en` object, so a typo is a compile error. |
| Lint | ESLint 9 flat config, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, plus a local rule `no-bare-jsx-strings` | The local rule flags string literals in JSX text and in `aria-label`, `title`, `placeholder`, `alt`; allowlist for non-linguistic strings (`"–"`, `"×"`, `"…"`, numbers, whitespace, and a `/* i18n-ignore */` comment). |
| Unit tests | Vitest + jsdom + Testing Library | As briefed. |
| Browser tests | Playwright (Chromium in CI; WebKit and Firefox runnable locally), `@axe-core/playwright` | As briefed. Screenshots at 360×640 and 1440×900 are a Playwright project with fixed viewports; output goes to `docs/screenshots/stage-<x>/`. |
| PWA | `vite-plugin-pwa` with `generateSW` (Workbox precache, cache-first), `registerType: 'prompt'` | `generateSW` covers "precache the whole app shell" with no hand-written worker to maintain. `prompt` mode is what gives us a banner instead of an automatic reload. The single base-path value is passed to the plugin's `base`, `scope` and `start_url`. |
| IDs | `crypto.randomUUID()` | Native in every target browser; no `uuid` package. |
| GEDCOM encodings | `TextDecoder` for UTF-8, UTF-16 LE/BE, Windows-1252; hand-written ANSEL → Unicode table | `TextDecoder('windows-1252')` is supported by all target browsers, so no `iconv-lite`. ANSEL is ≈120 code points including combining diacritics; a static table plus `String.normalize('NFC')` is enough. |
| Fonts | Atkinson Hyperlegible Next (SIL OFL 1.1), self-hosted WOFF2, split into unicode-range chunks at build time | See design plan §2 and §6 of this document. |
| PDF | Browser print-to-PDF | As briefed; no library. |

**Not used, and why:** no `i18next`, no `react-router`, no D3/ELK/dagre, no `uuid`, no `iconv-lite`, no `jspdf`/`pdf-lib`, no `opentype.js`/harfbuzz in the initial bundle (see §6).

## 2. Repository name and base path

**ASK.** The repository is `h17t/pedigree`, not `family-tree`. I propose to keep `pedigree` and make the default base `'/pedigree/'`:

```ts
// vite.config.ts
const base = process.env.VITE_BASE_PATH ?? '/pedigree/';
```

The same `base` is handed to `vite-plugin-pwa` (`scope`, `start_url`) and read by the service-worker registration, so renaming the repo or serving from a user page is a one-variable change (`VITE_BASE_PATH=/`). If you would rather the repo be renamed to `family-tree`, only that default string changes.

## 3. Module breakdown

```
index.html
vite.config.ts
eslint.config.js
playwright.config.ts
vitest.config.ts
/.github/workflows/deploy.yml     typecheck → lint → unit → build → budget → playwright → deploy
/scripts
  check-budget.mjs                 gzip sizes of dist/, fails on >250 KB initial JS / >500 KB initial payload
  split-fonts.mjs                  builds unicode-range WOFF2 chunks from the source font (dev-time only)
  make-perf-fixture.mjs            generates the 500-person fixture deterministically (seeded)
/eslint-rules
  no-bare-jsx-strings.js
/public
  fonts/                           WOFF2 chunks + OFL.txt
  icons/                           PWA icon set incl. maskable
/src
  main.tsx, App.tsx
  /design      tokens.ts (colour, type scale, spacing, card geometry), tokens.css, motion.css
  /i18n        en.ts, de.ts, index.ts (t, useT, plural, formatDate, formatNumber), keys.test.ts
  /model       types.ts, schema.ts (schemaVersion, migrations), validation.ts, graph.ts (cycles,
               ancestors/descendants, generations), delete.ts, merge.ts, duplicates.ts, dates.ts
               (internal date parse/format, both conventions, interpretation echo)
  /store       store.ts (Zustand), transact.ts (Immer patches, undo/redo), persistence.ts
               (autosave, recovery key, quota), lock.ts (multi-tab lock + heartbeat),
               projects.ts (project index), settings.ts
  /gedcom      lexer.ts, decode.ts (encoding sniff, ANSEL table), parse.ts, dates.ts (GEDCOM
               date grammar), toModel.ts, fromModel.ts, report.ts, index.ts (lazy entry)
  /render      Canvas.tsx, viewport.ts, PersonCard.tsx (shared screen/print), UnionNode.tsx,
               Connectors.tsx, /layout (generations.ts, clusters.ts, pack.ts, place.ts)
  /timeline    timeline.ts, statistics.ts (every metric returns {value, base, total}), charts/
  /ui          shell/ (AppShell, BottomNav, Toolbar, SidePanel, BottomSheet), forms/ (PersonForm,
               UnionForm, DateField), dialogs/ (ConfirmDelete, Merge, ProjectList), ListView.tsx,
               Search.tsx, Warnings.tsx, Toast.tsx, Undo.tsx
  /print       paper.ts, scale.ts, tiling.ts, PrintDialog.tsx, Preview.tsx, exportSvg.ts,
               exportPng.ts, fonts.ts (chunk selection + base64 embed), index.ts (lazy entry)
  /onboarding  FirstRun.tsx, Wizard.tsx, hints.ts, Help.tsx (lazy), QuickStart.tsx
  /pwa         register.ts, UpdateBanner.tsx, Install.tsx
  /fixtures    sample-family.json (the ~40-person sample = test fixture), perf-500.json
/tests
  /unit        mirrors src/ (Vitest)
  /e2e         Playwright specs: a11y.spec.ts, offline.spec.ts, sw-update.spec.ts,
               multitab.spec.ts, print-preview.spec.ts, screenshots.spec.ts
  /gedcom      sample .ged files: utf8, utf16, ansel, win1252, malformed, gedcom7-header,
               gramps-export, ahnenblatt-export
```

Lazy-loaded chunks (`React.lazy` + dynamic `import()`): `/gedcom`, `/timeline` (timeline + statistics views), `/print`, `/onboarding/Help`, and the two fixtures. Everything else is the initial bundle.

## 4. Key mechanisms

### 4.1 Store and undo
- `Project = { schemaVersion, id, name, createdAt, modifiedAt, persons: Record<id, Person>, unions: Record<id, Union>, childLinks: Record<id, ChildLink>, rawRecords: string[], settings }`.
- `store.transact(label, recipe)` runs `produceWithPatches`, pushes `{label, patches, inversePatches}` on the undo stack (cap 50, oldest dropped), clears redo, and schedules autosave. Nested `transact` calls join the outer one, which is how the wizard, auto-layout and merge-import become single steps without special casing.
- The undo stack is a plain in-memory array outside Zustand state (it must not be persisted and must not trigger re-renders on every push). Switching project clears it.
- Ephemeral UI state (selection, viewport, open panels, drag state) lives in a separate Zustand slice that is not part of undo and not autosaved, except viewport and mode, which are saved per project so a returning user lands where they left.

### 4.2 Persistence and failure modes
- Keys: `pedigree:index` (project list), `pedigree:project:<id>`, `pedigree:ui:<id>`, `pedigree:settings`, `pedigree:lock:<id>`, `pedigree:recovery:<id>:<timestamp>`, `pedigree:migration-backup:<id>:<fromVersion>`.
- Autosave debounced 500 ms, flushed on `visibilitychange`/`pagehide`.
- **Corrupt JSON**: parse failure moves the payload to a recovery key and shows the recovery screen (download raw, start fresh, load backup). Never overwritten.
- **Quota**: serialized length ×2 bytes is compared against a measured capacity (one-time probe on first run, cached). Warn at 80 %. `setItem` is atomic in every browser, so a `QuotaExceededError` leaves the previous good state intact; we surface it, keep the unsaved changes in memory, and offer export + trimming raw GEDCOM data. Usage is shown in the Data view.
- **Multi-tab lock**: `pedigree:lock:<id> = { tabId, heartbeat }`, heartbeat every 5 s, stale after 15 s. A second tab on the same project sees a live lock and opens read-only with "Take over editing". Taking over rewrites the lock; the old tab sees it via the `storage` event and drops to read-only with "Reload the newer version". Read-only tabs never call `setItem` for that project.
- **Migration**: `migrations[fromVersion](project)` chain; the pre-migration payload is written to a backup key first; a report lists what changed. `schemaVersion` greater than the code's is refused with a message naming both versions.

### 4.3 Dates
Internal representation as briefed: `{ date: 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' | null, qualifier }`. The UI parser accepts both keyword sets and both numeric conventions, using the date-format setting only to break ties in numeric slash/dot dates, and always returns an `interpretation` string for the echo plus an optional `alternative` for the one-click swap.

**ASSUMED**: GEDCOM `BET x AND y` and `FROM x TO y` do not fit `date + qualifier`. They import as `date = x`, `qualifier = 'about'` (BET) or `'exact'` (FROM), and the verbatim GEDCOM date value is kept in `gedcomDate` on the event. Export writes `gedcomDate` back verbatim as long as the user has not edited the date; editing clears it. Julian/dual-year values (`1750/51`, `@#DJULIAN@`) are handled the same way. This keeps round-trips lossless without inventing model fields the UI cannot edit.

### 4.4 Graph safety
`graph.ts` does every traversal iteratively with a visited set. Cycle detection is a DFS over parent edges with an on-stack set; the closing edge is reported as `{ childLinkId }`. Layout, ancestor/descendant filters and generation counting all call `breakCycles(project)` first and work on the resulting DAG; the data is never changed. Affected people get a visible marker and one warning entry.

### 4.5 Layout (stage d)
1. Break cycles. 2. Split into connected components (persons + unions). 3. Per component: assign generations by longest-path from roots through union nodes (partners equalized to the same rank, adopted/step links included). 4. Order within a rank: partners adjacent, siblings by birth date, then barycentre sweeps to reduce crossings. 5. Assign x from card width + gaps; unions become junction points between partners. 6. Components are packed left-to-right sorted by size, wrapping to a grid past a width threshold, with a gutter and a labelled boundary. People with `position: null` in an otherwise laid-out project are placed by running steps 3–5 on their component and translating only the null-position people to free space (existing positions are kept).

### 4.6 Print and export (stage g)
- Bounding box → printable area → `viewBox`; never CSS scale.
- Tiling: sheet grid from scale, overlap and paper size; each sheet is its own SVG with its own `viewBox`, crop marks, "Sheet n of m" and the assembly diagram on sheet 1.
- Effective font size = card font size × scale; below 6 pt triggers the legibility warning with alternatives in the briefed order.
- `@page` is injected as a `<style>` on print; the preview keeps the true aspect ratio regardless.
- PNG: render the SVG to an offscreen canvas; combinations over 8 000 px are disabled with the explanation.
- SVG: see §6.

### 4.7 GEDCOM (stage e)
- Lexer tolerates CR, LF, CRLF, BOMs, CONC/CONT, and over-long lines.
- Encoding: read `1 CHAR` from the header, validate against byte content (UTF-8 validity check, BOM, UTF-16 null-byte pattern); Windows-1252 when declared `ANSI` or when declared UTF-8 but invalid; ANSEL when declared ANSEL or when high bytes match ANSEL combining patterns. The report states the decoded encoding and whether it differed from the declaration.
- Per-record unknown lines → `rawGedcom` on person/union; unreferenced top-level records → `project.rawRecords`. One toggle disables both; the report says so.
- GEDCOM 7 (`2 VERS 7.0` or `1 GEDC` with `7.x`) is refused before parsing.
- Round-trip test: parse → serialize → parse → deep-equal after ID normalization.

## 5. Bundle budget enforcement
`scripts/check-budget.mjs` reads Vite's manifest, gzips every asset with `zlib`, sums the entry chunk plus its static imports as "initial JS" and adds `index.html`, CSS and the font chunks referenced at startup as "initial payload". Fails (exit 1) over 250 KB / 500 KB and prints a table that gets copied into the README at each stage. Only the Latin font chunks of two weights are loaded at startup; Latin-Extended loads on demand.

Estimated initial JS (gzipped): React + ReactDOM ≈ 45 KB, Zustand + Immer ≈ 8 KB, app code for stages a–d ≈ 60–90 KB, Workbox runtime ≈ 5 KB. That leaves comfortable headroom; the lazily loaded GEDCOM, timeline/statistics and print modules do not count.

## 6. Fonts in exported SVG
The brief asks for a base64 WOFF2 "subsetted to the glyphs used". True per-glyph subsetting in the browser needs a font compiler (harfbuzz-wasm ≈ 700 KB, or `opentype.js` + a WOFF2 encoder). **ASSUMED**: I will instead split the font at build time into unicode-range chunks (Latin, Latin-Extended-A, Latin-Extended-Additional, General Punctuation and symbols such as `† * ~ < >`) and embed only the chunks whose ranges the exported text actually uses. The resulting SVG carries roughly 20–40 KB of font per weight for a typical German/English tree, is fully portable, keeps text selectable, and needs no parser in the bundle. If you want true per-glyph subsetting, it is possible as a lazy-loaded ≈700 KB module inside the print chunk; say so and I will plan it in stage (g). SIL OFL 1.1 explicitly permits embedding in documents (the reserved-name clause only concerns modified font files), which is recorded in `DECISIONS.md`.

## 7. Stage plan

Each stage ends with: unit tests green, Playwright a11y and screenshot jobs green, strings complete in `de` and `en`, verified at 360×640 and 1440×900, deployed to Pages, `PROGRESS.md` and `DECISIONS.md` updated, and a status report to you.

| Stage | Delivers | Tests added |
|---|---|---|
| **a** | Vite/React/TS scaffold, tokens, fonts, i18n + ESLint rule, full data model + validation + graph utilities + migration frame, Zustand store + Immer undo/redo, persistence with recovery/quota/multi-tab lock, project list, list/outline view (read-only navigation of a project), sample-family fixture, CI + Pages workflow, bundle budget script, README, LICENSE | key parity; date parser both locales/settings; validation rules; cycle detection; migration; undo batching; persistence recovery; quota handling; lock behaviour (Playwright); axe on list view; screenshots |
| **b** | SVG canvas: viewport (pan/zoom/fit/buttons), person cards (all four variants), union junctions, orthogonal connectors with marriage/divorce/unmarried/adoption styles, selection, drag on pointer devices, error boundary, search, focus/filter mode | card truncation; connector routing; filter with cycles; axe on canvas; screenshots |
| **c** | Person/union forms (bottom sheet on phone, side panel on desktop), date field with echo, context actions (add partner/child/parent/sibling), delete with impact preview, union delete choices, merge dialog, duplicate list, warnings panel, undo buttons, multi-select | delete rules; merge re-pointing; duplicates; wizard-free form round-trip; axe on form; screenshots |
| **d** | Auto-layout with generations, clusters, null-position placement, "re-arrange selection", snap-to-grid, alignment guides, jump-to-cluster | layout determinism on sample; disconnected clusters; null positions; cycle-broken layout; 500-person timing |
| **e** | GEDCOM import (new/merge) and export, encodings, report, raw preservation toggle | all sample files; malformed; Windows-1252; GEDCOM 7 refusal; round-trip model equality; strict re-import |
| **f** | Timeline and statistics views with base populations, charts with tables, historical layer (after you confirm the list) | statistics bases; timeline ranges; generation count with cycles; axe; screenshots |
| **g** | Print dialog, preview, fit/tile modes, legibility warning, SVG/PNG export with font embedding, PDF instructions | scale and tiling math; PNG cap; font chunk selection; print preview (Playwright); axe on print dialog |
| **h** | First-run screen, wizard, resumable state, inline hints, help page (de/en), printable quick start, "Add grandparents" next action | wizard writes valid model + single undo step; hint persistence; axe on wizard; screenshots |
| **i** | Manifest, service worker, update banner, install entry, iOS instructions, docs | offline session; SW update keeps localStorage; migration backup (Playwright) |
| **j** | Final a11y audit, performance pass on 500 people (including a throttled-CPU Playwright run), README numbers, network-tab verification, manual screen-reader checklist handed to you | — |

## 8. Things I need from you before stage (a)
1. Repository name / base path (§2).
2. Approval of the design plan (`docs/DESIGN_PLAN.md`), in particular the typeface and the card geometry, since both drive the layout maths.
3. The copyright holder name for the MIT `LICENSE` file.
4. Confirmation of the historical-context list (design plan §7), which is needed only from stage (f).
5. Whether the chunk-level font subsetting in §6 is acceptable.
