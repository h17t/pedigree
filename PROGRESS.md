# Progress

Current status (2026-09-13): **planning complete, awaiting approval of the technical and design plans.**
No application code exists yet.

Plans: `docs/TECHNICAL_PLAN.md`, `docs/DESIGN_PLAN.md`. Decisions: `DECISIONS.md`.

## Stage checklist

Every stage is "done" only when all of these hold: unit tests green, Playwright a11y and
screenshot jobs green, every string present in `de` and `en`, verified at 360×640 and 1440×900,
deployed to GitHub Pages, `PROGRESS.md` and `DECISIONS.md` updated, status report sent.

- [ ] **Plan** — technical plan and design plan written; **waiting for approval**
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

- [ ] Approve or amend the technical plan (repository name / base path, font subsetting approach)
- [ ] Approve or amend the design plan (typeface, card geometry, light-only theme)
- [ ] Confirm the historical-context list (needed by stage f)
- [ ] Provide the copyright holder name for the MIT `LICENSE` (needed by stage a)
- [ ] Manual screen-reader checklist (VoiceOver macOS/iOS, NVDA) — **pending**, will be written in stage (j) and handed over; screen-reader support is not claimed until it has been run

## Screenshots

Stored under `docs/screenshots/stage-<x>/` at 360×640 and 1440×900 from stage (a) onwards.
