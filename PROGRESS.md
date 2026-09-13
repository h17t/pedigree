# Progress

Current status (2026-09-13): **stage (c) complete; stage (d) (auto-layout with clusters) is next.**

Stage (a) delivered: Vite/React/TypeScript scaffold with bundled fonts, design tokens, typed de/en
dictionary with the `no-bare-jsx-strings` ESLint rule, the complete data model with date parsing,
validation, cycle-safe graph utilities and the migration frame, the Zustand store with Immer-patch
undo/redo (batched, capped at 50, in memory only), persistence with corrupt-data recovery, quota
handling and the multi-tab edit lock, the project list, the outline list view with search and a
read-only details panel, the Data view (backup, storage meter, language, date format), the
sample-family fixture (48 people) and the 500-person performance fixture, the CI + Pages workflow,
the bundle budget script, README and LICENSE.

Stage (b) delivered: the SVG canvas with pan (drag, middle mouse, space+drag, one finger), zoom
(wheel, pinch, buttons, Ctrl+0, keyboard), fit, the person card in all four fixed height variants
with truncation, sex markers, † and slate border for deceased, branch stripe with label and
warning marker, union junctions and the labelled "Parents unknown" box, orthogonal connectors
(double line, struck double line, dashed, child line styles by relation type), selection by
click/tap/keyboard, card drag with persisted positions on pointer devices, search that jumps to
and selects a person (Ctrl+F), the focus filter (ancestors, descendants, close family) with a
visible "Showing…" bar, the legend, the card-detail selector, an error boundary around the
canvas, the phone selection bar and the laptop details column. Provisional placement gives every
person without a position a deterministic spot until the real layout arrives in stage (d).
109 unit tests and 31 Playwright tests pass.

Stage (c) delivered: the person editor (every field, events, custom fields, branch tag, the
death-date-forces-deceased rule), the partnership editor, the date field with the plain-language
echo and the one-click alternative reading, fast entry (add partner, child with family choice,
father, mother, sibling) from the details column and the phone selection bar, "Add person" for
unconnected people, delete with an exact impact preview, the two-choice partnership removal, the
merge dialog with per-field choice and conflict preservation, the possible-duplicates list in the
Data view, the warnings dialog reachable from the header badge, visible Undo/Redo buttons with
keyboard shortcuts, and multi-select on laptops (Shift+click, Shift+drag, group move, delete as
one step). 122 unit tests and 38 Playwright tests pass.

Plans: `docs/TECHNICAL_PLAN.md`, `docs/DESIGN_PLAN.md`. Decisions: `DECISIONS.md`.

## Stage checklist

Every stage is "done" only when all of these hold: unit tests green, Playwright a11y and
screenshot jobs green, every string present in `de` and `en`, verified at 360×640 and 1440×900,
deployed to GitHub Pages, `PROGRESS.md` and `DECISIONS.md` updated, status report sent.

- [x] **Plan** — technical plan and design plan written and approved (repo stays `pedigree`, Atkinson Hyperlegible Next, cards 220 × 84/124/164/280, chunk-level font embedding, light theme only, eight-entry historical list)
- [x] **(a)** design tokens, fonts, i18n + ESLint rule, data model, validation, graph utilities, migration frame, store + undo/redo, persistence (recovery, quota, multi-tab lock), project list, outline list view, sample fixture, CI + Pages pipeline, bundle budget, README, LICENSE — screenshots in `docs/screenshots/stage-a/`
- [x] **(b)** SVG canvas, viewport, person cards (four variants), union junctions, connectors, selection, drag, error boundary, search, focus/filter — screenshots in `docs/screenshots/stage-b/`
- [x] **(c)** person/union forms, date field with echo, context actions, delete with impact preview, union delete choices, merge, duplicates, warnings, undo buttons, multi-select — screenshots in `docs/screenshots/stage-c/`
- [ ] **(d)** auto-layout with generations and clusters, null-position placement, re-arrange selection, snap-to-grid, alignment guides, jump-to-cluster
- [ ] **(e)** GEDCOM import (new / merge) and export, encodings, import report, raw preservation toggle
- [ ] **(f)** timeline and statistics with base populations, charts with data tables, historical layer
- [ ] **(g)** print dialog, preview, fit / tile, legibility warning, SVG / PNG export with embedded fonts, PDF instructions
- [ ] **(h)** first-run screen, wizard, inline hints, help page, printable quick start
- [ ] **(i)** manifest, service worker, update banner, install entry, offline verification
- [ ] **(j)** final accessibility audit, 500-person performance pass, README numbers, network-tab verification

## Known open points after stage (b)

- Cards without a stored position are placed by a provisional row layout (one row per generation, partners adjacent, components side by side). It is deliberately wide and does not reduce crossings; stage (d) replaces it with the real layout, cluster packing and placement into free space. Until then "Fit" on a phone shows a very small tree, and the search jump is the practical way to a person.
- Snap-to-grid and alignment guides are wired in the canvas (`snapToGrid` prop) but switched off until the toolbar control arrives with stage (d).
- Black-and-white rendering of the branch stripes is implemented as SVG patterns and used by print in stage (g).

- The Pages deployment has not run yet: the workflow triggers on push to `main`, and all work so far is on the feature branch. Once merged, set **Pages → Source: GitHub Actions** in the repository settings and check the published URL.
- Undo/redo exists in the store with tests, but the visible Undo/Redo buttons arrive with the first editing UI in stage (c) (nothing is editable yet in stage a apart from project names).
- The bottom navigation shows only the modes that exist (List, Data, Family trees); Tree, Timeline and Statistics are added as they are built rather than as placeholders.
- The first-run screen is the plain project list for now; the designed first-run experience with the wizard is stage (h).
- The storage capacity is measured lazily the first time the Data view opens (a short probe write); until then the meter assumes 5 MB.

## Pending items that need the user

- [x] Technical plan approved (repository name / base path, font subsetting approach)
- [x] Design plan approved (typeface, card geometry, light-only theme)
- [x] Historical-context list confirmed (the eight proposed entries, no additions)
- [x] Copyright holder for the MIT `LICENSE`: h17t
- [ ] Manual screen-reader checklist (VoiceOver macOS/iOS, NVDA) — **pending**, will be written in stage (j) and handed over; screen-reader support is not claimed until it has been run

## Screenshots

Stored under `docs/screenshots/stage-<x>/` at 360×640 and 1440×900 from stage (a) onwards.
