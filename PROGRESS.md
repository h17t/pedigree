# Progress

Current status (2026-09-13): **technical and design plans approved; stage (a) is next.**
No application code exists yet.

Plans: `docs/TECHNICAL_PLAN.md`, `docs/DESIGN_PLAN.md`. Decisions: `DECISIONS.md`.

## Stage checklist

Every stage is "done" only when all of these hold: unit tests green, Playwright a11y and
screenshot jobs green, every string present in `de` and `en`, verified at 360×640 and 1440×900,
deployed to GitHub Pages, `PROGRESS.md` and `DECISIONS.md` updated, status report sent.

- [x] **Plan** — technical plan and design plan written and approved (repo stays `pedigree`, Atkinson Hyperlegible Next, cards 220 × 84/124/164/280, chunk-level font embedding, light theme only, eight-entry historical list)
- [ ] **(a)** design tokens, fonts, i18n + ESLint rule, data model, validation, graph utilities, migration frame, store + undo/redo, persistence (recovery, quota, multi-tab lock), project list, outline list view, sample fixture, CI + Pages pipeline, bundle budget, README, LICENSE
- [ ] **(b)** SVG canvas, viewport, person cards (four variants), union junctions, connectors, selection, drag, error boundary, search, focus/filter
- [ ] **(c)** person/union forms, date field with echo, context actions, delete with impact preview, union delete choices, merge, duplicates, warnings, undo buttons, multi-select
- [ ] **(d)** auto-layout with generations and clusters, null-position placement, re-arrange selection, snap-to-grid, alignment guides, jump-to-cluster
- [ ] **(e)** GEDCOM import (new / merge) and export, encodings, import report, raw preservation toggle
- [ ] **(f)** timeline and statistics with base populations, charts with data tables, historical layer
- [ ] **(g)** print dialog, preview, fit / tile, legibility warning, SVG / PNG export with embedded fonts, PDF instructions
- [ ] **(h)** first-run screen, wizard, inline hints, help page, printable quick start
- [ ] **(i)** manifest, service worker, update banner, install entry, offline verification
- [ ] **(j)** final accessibility audit, 500-person performance pass, README numbers, network-tab verification

## Pending items that need the user

- [x] Technical plan approved (repository name / base path, font subsetting approach)
- [x] Design plan approved (typeface, card geometry, light-only theme)
- [x] Historical-context list confirmed (the eight proposed entries, no additions)
- [x] Copyright holder for the MIT `LICENSE`: h17t
- [ ] Manual screen-reader checklist (VoiceOver macOS/iOS, NVDA) — **pending**, will be written in stage (j) and handed over; screen-reader support is not claimed until it has been run

## Screenshots

Stored under `docs/screenshots/stage-<x>/` at 360×640 and 1440×900 from stage (a) onwards.
