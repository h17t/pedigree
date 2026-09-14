# Pedigree

A fully client-side family tree editor for the browser. Create, edit, print and export a family
tree without a server, an account or any network traffic. **All data stays on the device.**

Status: **stage (g) of (j) complete** — data model, storage, the tree canvas with auto-layout,
the outline list view, the project list, full editing, GEDCOM import/export, timeline, statistics,
printing and export work; onboarding and offline support follow in the next stages. See `PROGRESS.md` for the checklist and `DECISIONS.md` for
every design and technical decision.

Plans: `docs/TECHNICAL_PLAN.md`, `docs/DESIGN_PLAN.md`. Screenshots per stage: `docs/screenshots/`.

## Using the app

- Open the site. Choose **Start with yourself** (a four-step guided start: you, parents, partner,
  children; every step can be skipped and the result is one undo step), **Look at the sample
  family**, **Start an empty tree** or **Restore a backup file**.
- **Help** in the header opens a one-page help in the current language with a printable quick
  start, and can bring the small tips back or run the guided start again.
- **Tree** draws the family as cards and lines. Drag the picture to move around, pinch or use the
  buttons to zoom, tap or click a card to select it, type a name to jump to a person, and use
  "Show only" to see just the ancestors or descendants of the selected person. On a laptop you can
  drag cards; their positions are saved. **Layout** arranges the whole tree by generation (undoable),
  arranges only a selection, toggles snap-to-grid and jumps to each family. **Layout → Balance
  generations** (off by default; gentle or strong) shrinks crowded generations, so a family with
  20 great-grandparents and 6 people today still reads as one balanced drawing on screen and in
  print; the scale depends only on how many people each generation holds.
- **List** shows every family as an indented outline; choose a person to see their details.
- Choose a person, then **Edit**, **Add** (partner, child, father, mother, sibling) or **Delete**.
  Deleting explains exactly what else changes; **Undo** and **Redo** are always in the header.
- **Link an existing person** (under Add) connects two people who are already in the tree as
  partners, child, parent or sibling; people who cannot take the role are listed with the reason.
  A person can have any number of partnerships. Nothing about a relationship is assumed: a new
  partnership, and the parents of a person, are "not recorded" until you set the kind in the
  partnership editor, which also lists the children (with adopted, step or foster) and lets you
  remove a person from a partnership or a family without deleting them.
- **Timeline** shows one lifespan bar per person, zoomable, with an optional layer of a few
  historical events (off by default). **Statistics** shows counts, ages and most common names, and
  every figure says how many people it is based on.
- **Print & export** (in the Tree, Timeline and Statistics views) opens a dialog with paper size,
  orientation, margins, "fit on one page" or "spread across several sheets", detail level, title
  and legend, a to-scale preview, and buttons to print, to save an SVG file (fonts embedded) or a
  PNG image. See "Printing large trees" below.
- **Data → GEDCOM files** imports a `.ged` file (GEDCOM 5.5.1; UTF-8, UTF-16, ANSEL and
  Windows-1252 are recognised) as a new tree or into the open tree, shows an import report, and
  exports the tree as GEDCOM 5.5.1 for other programs. GEDCOM 7 files are refused with an explanation.
- **Data → Possible duplicates** lists people who may be the same person and lets you merge them
  field by field.
- **Data** holds the backup buttons, the storage meter, the language and the date-format setting.
- Save a backup file (a `.json` file) regularly. The browser can delete site data at any time; the
  backup file is the only copy you control. The app reminds you after 50 changes or 7 days.
- Opening the same tree in two tabs: the first tab edits, the second is read-only and can take over.
- After the first visit the app works offline. **Data → Install on this device** adds it to the
  home screen or app list (on iPhone and iPad: Share → Add to Home Screen in Safari). A new version
  is announced with a notice and applied only when you choose **Reload now**; updates never touch
  your data.

## Development

Requirements: Node 22 LTS (≥ 22.19) and npm. (jsdom 30, used by the unit tests, needs undici 8, which needs Node 22.19.)

```
npm ci            # install
npm run dev       # dev server at http://localhost:5173/pedigree/
npm run check     # typecheck + lint + unit tests + build + bundle budget
npm run test:e2e  # Playwright browser tests (builds first with `npm run build`)
```

Useful scripts:

| Script | What it does |
|---|---|
| `npm run typecheck` | `tsc -b` in strict mode |
| `npm run lint` | ESLint incl. the local rule that bans untranslated strings in JSX |
| `npm run test` | Vitest unit tests (`tests/unit`) |
| `npm run build` | Production build into `dist/` |
| `npm run budget` | Gzip sizes of the initial payload; fails over budget |
| `npm run test:e2e` | Playwright: axe-core checks, multi-tab lock, corrupt-data recovery, screenshots at 360×640 and 1440×900 |
| `node scripts/make-sample-fixture.mjs` | Regenerates the sample family (`src/fixtures/sample-family.json`) |
| `node scripts/make-perf-fixture.mjs` | Regenerates the 500-person performance fixture |

In the remote development sandbox, set `PLAYWRIGHT_SANDBOX_CHROMIUM=1` to use the pre-installed
Chromium instead of downloading one.

## Deployment and base path

The site is deployed by `.github/workflows/deploy.yml`: on every push to `main` it runs typecheck,
lint, unit tests, build, bundle budget and the Playwright suite, and only then publishes `dist/`
to GitHub Pages. A failing check blocks the deployment. In the repository settings, set
**Pages → Source** to **GitHub Actions** once.

The base path is one value, `VITE_BASE_PATH`, read in `vite.config.ts` and defaulting to
`/pedigree/` (the repository name). Vite's `base`, every in-app absolute URL, the PWA manifest's
`start_url`/`scope`/`id`, the service worker's navigation fallback and its registration path all
derive from it.

| Where the site is served | Setting |
|---|---|
| `https://<user>.github.io/pedigree/` | nothing to do (default) |
| renamed repository `foo` | `VITE_BASE_PATH=/foo/` in the workflow's build step |
| user page or custom domain, served from `/` | `VITE_BASE_PATH=/` |

## Bundle budget

Budget: initial JS under 250 KB gzipped, total initial payload under 500 KB. Measured by
`npm run budget` after the final build:

| Asset group | gzipped | budget |
|---|---|---|
| Initial JS (entry + static imports) | 148.5 KB | 250.0 KB |
| Initial CSS | 5.6 KB | — |
| index.html | 0.5 KB | — |
| Fonts loaded at startup | 24.3 KB | — |
| **Initial payload** | 179.0 KB | 500.0 KB |

The sample family, the GEDCOM module, the timeline/statistics views, the guided start, the help
page and the print dialog load lazily and do not count.

## Performance with 500 people

Measured by `tests/e2e/perf.spec.ts` on the 500-person fixture with the CPU throttled 4× through
the DevTools protocol (an approximation of a mid-range phone), Chromium, in the CI container.
Wall-clock milliseconds, including the UI round trip:

| Step | 1440×900 | 360×640 |
|---|---|---|
| Restore the 500-person backup and draw the tree | 600–2 700 | 400–500 |
| Arrange the whole tree (layout + one undo step + redraw) | 700 | 500 |
| Fit to the window | 370 | 270 |
| One wheel-zoom step, average of ten (time to next frame) | 230–270 | 140–160 |
| List view of all families | 1 100 | 1 050 |
| Timeline of all dated people | 1 000 | 1 000 |

The first row varies between runs (it includes reading the file and the first paint of the
whole tree); the others were stable within about 10 % over four runs. The raw numbers of the last
run are in `docs/perf-desktop.json` and `docs/perf-phone.json`.

Above 150 visible cards the canvas renders only the cards that intersect the window (plus a
margin) and, below 40 % zoom, draws only name and years on each card; smaller trees keep every
card in the DOM so keyboard and screen-reader users can reach all of them. The layout itself
takes well under a second for 500 people without throttling (unit test).

## Accessibility

Every view and dialog state is checked with axe-core (WCAG 2.1 A and AA plus best practices) in
the Playwright suite, together with keyboard-only paths (skip link, header, navigation, canvas
cards, undo shortcuts) in both languages. The manual screen-reader run (VoiceOver on macOS and
iOS, NVDA) is written up in `docs/SCREEN_READER_CHECKLIST.md` and has **not been performed yet**;
until it is, this README does not claim screen-reader support.

## Printing large trees

A home printer handles A4 and often A3. For anything larger, the browser's print dialog only offers
the sizes the installed printer driver knows, so A2 and A1 rarely work at home. The reliable route
for a large family tree is:

1. Open **Print & export**, choose the paper size you want at the print shop (A2, A1) and
   **Save an SVG file**. The file keeps the text selectable and the fonts are embedded, so it looks
   the same on any machine.
2. Take the SVG file to a print shop (or a plotter). Ask for "actual size".

Alternatively, choose **Spread across several sheets** to print a large tree at a readable size on
your own A4 or A3 sheets, with crop marks, sheet numbers and an assembly plan on the first sheet.

For a PDF, choose "Save as PDF" as the printer in the browser's print dialog. In that dialog, pick
the same paper size and orientation as in the app and "Actual size" or "100 %" rather than "Fit to
page". Some browsers ignore the paper size the app requests; the in-app preview shows the correct
proportions in any case.

## Privacy

There is no server, no account, no analytics, and no network request after the page has loaded
(verified by a Playwright test that records every request; the service worker only serves the
app's own files from its cache). Data lives in the browser's
`localStorage` for this site only. Fonts are bundled with the app (Atkinson Hyperlegible Next,
SIL Open Font License, see `public/fonts/OFL.txt`).

## Licence

MIT, see `LICENSE`.
