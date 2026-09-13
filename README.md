# Pedigree

A fully client-side family tree editor for the browser. Create, edit, print and export a family
tree without a server, an account or any network traffic. **All data stays on the device.**

Status: **stage (a) of (j) complete** — data model, storage, the outline list view and the
project list work; the canvas, editing forms, GEDCOM, timeline, printing, onboarding and offline
support follow in the next stages. See `PROGRESS.md` for the checklist and `DECISIONS.md` for
every design and technical decision.

Plans: `docs/TECHNICAL_PLAN.md`, `docs/DESIGN_PLAN.md`. Screenshots per stage: `docs/screenshots/`.

## Using the app

- Open the site. Choose **Start an empty tree**, **Look at the sample family** or **Restore a backup file**.
- **List** shows every family as an indented outline; choose a person to see their details.
- **Data** holds the backup buttons, the storage meter, the language and the date-format setting.
- Save a backup file (a `.json` file) regularly. The browser can delete site data at any time; the
  backup file is the only copy you control. The app reminds you after 50 changes or 7 days.
- Opening the same tree in two tabs: the first tab edits, the second is read-only and can take over.

## Development

Requirements: Node 20 LTS (≥ 20.19) and npm.

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
`/pedigree/` (the repository name). Vite's `base`, every in-app absolute URL and — from stage (i) —
the PWA manifest's `start_url`/`scope` and the service-worker registration path all derive from it.

| Where the site is served | Setting |
|---|---|
| `https://<user>.github.io/pedigree/` | nothing to do (default) |
| renamed repository `foo` | `VITE_BASE_PATH=/foo/` in the workflow's build step |
| user page or custom domain, served from `/` | `VITE_BASE_PATH=/` |

## Bundle budget

Budget: initial JS under 250 KB gzipped, total initial payload under 500 KB. Measured by
`npm run budget` after the stage (a) build:

| Asset group | gzipped | budget |
|---|---|---|
| Initial JS (entry + static imports) | 94.8 KB | 250.0 KB |
| Initial CSS | 3.6 KB | — |
| index.html | 0.5 KB | — |
| Fonts loaded at startup | 24.3 KB | — |
| **Initial payload** | 123.1 KB | 500.0 KB |

The sample family loads lazily (4.2 KB). The GEDCOM module, the timeline/statistics views and the
print/export module will be lazy chunks as well.

## Privacy

There is no server, no account, no analytics, and no network request after the page has loaded
(verified by a Playwright test that records every request). Data lives in the browser's
`localStorage` for this site only. Fonts are bundled with the app (Atkinson Hyperlegible Next,
SIL Open Font License, see `public/fonts/OFL.txt`).

## Licence

MIT, see `LICENSE`.
