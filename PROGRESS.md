# Progress

Current status (2026-09-13): **all stages (a)–(j) complete and deployed** to https://h17t.github.io/pedigree/ (workflow run #5 on `main`). One item remains with the user: the manual screen-reader run (see below).

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

Stage (d) delivered: the generational layout engine (longest-path ranks with partner
equalisation, couple blocks with the hub person between partners, barycentre ordering sweeps,
parents centred over children and sibling runs centred under parents), cluster packing (row up
to four families, grid beyond, largest first, with a gutter), dashed family frames with labels on
the canvas, "Arrange the whole tree" as one undo step, "Arrange only the selected people",
snap-to-grid, alignment guides while dragging, a family list with "Show family n" and "Show all
families", and placement of people without a stored position into free space (dotted outline
until arranged). 134 unit tests and 39 Playwright tests pass; 500 people lay out in well under a second.

Stage (e) delivered: GEDCOM 5.5.1 import and export as a lazily loaded module. Encoding
detection (UTF-8 with or without BOM, UTF-16 LE/BE, ANSEL with a hand-written table,
Windows-1252 for "ANSI" declarations and for invalid UTF-8), a tolerant lexer (CR/LF/CRLF,
CONC/CONT, level jumps), the date grammar (ABT/EST/CAL/BEF/AFT/BET…AND/FROM…TO, partial
dates, Julian and dual years kept verbatim), mapping of INDI/NAME (GIVN, SURN, NICK, NPFX,
_MARNM)/SEX (+_GENDER)/BIRT/DEAT (CAUS)/BAPM/CHR/BURI/RESI/EMIG/OCCU/RELI/NOTE (records
inlined)/SOUR (free text)/_UDF and FAM/HUSB/WIFE/CHIL/MARR/DIV/_STAT with PEDI relation types,
verbatim preservation of unknown lines per person/family and of unreferenced top-level records,
stable cross-reference ids on export, an import report (counts, encoding, ignored tags,
preserved records, uncertain dates, problems, dangling references, warnings, notes) and an
export report, import as a new tree (laid out) or merged into the open tree as one undo step,
the "keep unknown data" toggle with a size read-out and a remove button, six GEDCOM sample files
including malformed, Windows-1252, UTF-16, ANSEL and GEDCOM 7, and a round-trip test asserting
model equality. 163 unit tests and 42 Playwright tests pass.

Stage (f) delivered: the Timeline mode (one lifespan bar per person, sorted by birth year or
grouped by family, four zoom steps, uncertain dates with dashed edges, living people as open bars
to today, unknown status as short faded bars, a legend, the count of undated people, choosing a
bar shows the person in the tree, and the historical layer with the agreed eight entries, off by
default, labelled as orientation only) and the Statistics mode (people, partnerships, generations,
birth-year range, sex, life status, age at death, average age at death by decade and sex, age at
first marriage, children per partnership, month of birth, most common given names, surnames,
occupations and places), every metric with its base population, charts as lean SVG with text
labels and a data table behind a disclosure. Both views are a lazily loaded chunk.
173 unit tests and 48 Playwright tests pass.

Stage (g) delivered: the in-app print dialog (paper A5–A1, orientation, margin, fit-to-one-page
or tiling with a chosen scale and overlap, detail level, scope: whole tree / selection / current
filter / one family, title, subtitle, date, legend, black-and-white; content: tree, timeline or
statistics sheet), a to-scale preview with margins and a sheet-by-sheet view in tiling mode with
crop marks and an assembly plan on sheet 1, the legibility warning below 6 pt with alternatives in
the briefed order, the large-format advice for A3 and up, printing through the browser with a
matching @page rule and plain instructions for the system dialog and for "Save as PDF", SVG export
with the fonts embedded as base64 WOFF2 chunks (only the chunks the text uses), PNG export at
150/300/600 dpi capped at 8 000 px with the oversized combinations disabled and explained, and
unit tests for the scaling, tiling, cap and font-chunk maths. 181 unit tests and 53 Playwright
tests pass.

Stage (h) delivered: the first-run screen (welcome, three large choices with "Start with
yourself" as the primary one, a quiet restore panel below, a link to the help), the guided start
as a four-step form (you, parents, partner, children; every step skippable; progress line and
step count; back; a draft saved on every change so leaving mid-way loses nothing and a reload
reopens the same step; the result written through the ordinary edit functions as ONE undo step,
laid out at once, with "you" selected and the "Next: add grandparents" tip on the canvas),
contextual tips (one at a time, dismissible, remembered on the device: add grandparents, choose a
person, tidy up the tree, save a backup, try the list), the help page in German and English
(printable one-page quick start, adding people and relationships, reading the lines, dates with
`~ < >`, backups and restoring, printing including print shop and PDF, keyboard) reachable from
the header, the first-run screen and the empty tree, with "run the guided start again" and "show
the tips again". 187 unit tests and 66 Playwright tests pass.

Stage (i) delivered: the installable, offline-capable app. `vite-plugin-pwa` generates a precaching
service worker for the whole build (app files, fonts, icons; navigations fall back to the cached
shell) with `registerType: 'prompt'`, so a new version waits until the user chooses "Reload now" in
the in-app notice and never interrupts an edit; a one-time "ready to work offline" notice and an
"Offline" notice while the connection is gone; the web app manifest with `start_url`, `scope` and
`id` derived from the base path, standalone display, 192/512 px icons and a maskable icon rendered
from the SVG mark by `scripts/make-icons.mjs`; "Install on this device" on the Data page with the
native prompt where the browser offers one, Safari instructions on iPhone and iPad and a generic
hint elsewhere; a help section on offline use and installing; unit tests for the install/update
store and Playwright tests that read the manifest, reload the app offline (including a lazy view)
and check that an update pass leaves every `pedigree:*` key in localStorage untouched. 191 unit
tests and 72 Playwright tests pass.

Stage (j) delivered: the final accessibility audit as a Playwright spec (axe over the tree with a
selection, the add menu, the legend, the layout panel, an active filter, the multi-select bar, the
partnership form, the warnings dialog, the wizard summary step, the project list with a resumable
draft, and the German tree, wizard and help; a keyboard-only path through skip link, search,
cards, canvas zoom and pan, and the undo shortcut; a check that no English strings leak into the
German wizard), which found one real defect (the legend heading skipped a level) that is fixed;
the 500-person performance pass under 4× CPU throttling with numbers in the README, which led to
three changes: the card pointer handler is identity-stable so pan and zoom no longer re-render
every card, large trees (above 150 visible cards) render only the cards in the window, and below
40 % zoom large trees draw only name and years per card (zoom steps went from about 950 ms to
about 230 ms throttled on a laptop window and to about 140 ms on a phone window); the network
verification (no request leaves the origin after load; the service worker serves only the app's
own files); the manual screen-reader checklist in `docs/SCREEN_READER_CHECKLIST.md`; and the
deployment note below. 191 unit tests and 82 Playwright tests pass.

After the first use (2026-09-13), two reports led to a relationship-states pass: the guided start
no longer marks everyone as living or the parents as married (each person has living / deceased
with year / not known, and the parents' relationship is a visible choice that defaults to "not
recorded"); "Add partner" and a second parent no longer assume a marriage; "Link an existing
person" (as partner, child, parent or sibling) connects people already in the tree, refusing
impossible links with the reason (same person, already linked, would create an ancestor loop, two
parents already); the partnership editor lists partners and children, lets the relation of a child
be set (biological, adopted, step, foster) and removes a person from a partnership or a family
without deleting them; the details column removes the link to a person's parents. A person can
have any number of partnerships, past or present. 195 unit tests and 90 Playwright tests pass.

Balance generations (2026-09-14, a user suggestion): a per-tree layout setting, off by default,
with gentle (cards no smaller than 60 %) and strong (35 %). Each family's rows are scaled from
their head counts alone: the target width is the wider of the widest row at the minimum scale and
the median row, rows narrower than the target keep full size, wider rows shrink to it. The layout
engine spaces every row with its own card size and stacks rows by their scaled heights, parents
are centred over children by card centres, the canvas, hit testing, alignment guides, family frames,
placement of unplaced people and the print output all use the scaled boxes, and the print dialog's
"smallest text" figure accounts for the smallest card. Changing the setting re-arranges the tree
in the same undo step. 200 unit tests and 92 Playwright tests pass.

Usability pass after the second round of use (2026-09-14): relationships are edited in one
"Family" panel directly under the person's name (father, mother, parents' relationship, each
partner with the children of that partnership, siblings; "New person" / "Choose existing" next to
every empty slot, "Remove" on every link, "Edit" on every partnership), replacing the add menu,
the link menu, the partnership buttons and the parent-link button; removing one parent moves the
child to a union with the remaining parent so siblings are untouched. The list mode is now a flat
alphabetical people list with search (the family outline had a real bug: its grid styling
overrode the `hidden` attribute, so the plus/minus toggles appeared to do nothing, and it
duplicated what the tree and the Family panel show). Cards no longer print "living"; the absence
of a death date is enough. Divorced partnerships show two clear strokes through the junction
instead of a small slash beside it. "Close family" no longer brings the partners of relatives (a
partner's ex-partners, siblings' spouses): it shows parents, siblings, children, grandparents,
grandchildren and the person's own partners; "Ancestors" shows exactly the ancestors and
"Descendants" keeps the descendants' partners. 202 unit tests and 92 Playwright tests pass.

Plans: `docs/TECHNICAL_PLAN.md`, `docs/DESIGN_PLAN.md`. Decisions: `DECISIONS.md`.

## Stage checklist

Every stage is "done" only when all of these hold: unit tests green, Playwright a11y and
screenshot jobs green, every string present in `de` and `en`, verified at 360×640 and 1440×900,
deployed to GitHub Pages, `PROGRESS.md` and `DECISIONS.md` updated, status report sent.

- [x] **Plan** — technical plan and design plan written and approved (repo stays `pedigree`, Atkinson Hyperlegible Next, cards 220 × 84/124/164/280, chunk-level font embedding, light theme only, eight-entry historical list)
- [x] **(a)** design tokens, fonts, i18n + ESLint rule, data model, validation, graph utilities, migration frame, store + undo/redo, persistence (recovery, quota, multi-tab lock), project list, outline list view, sample fixture, CI + Pages pipeline, bundle budget, README, LICENSE — screenshots in `docs/screenshots/stage-a/`
- [x] **(b)** SVG canvas, viewport, person cards (four variants), union junctions, connectors, selection, drag, error boundary, search, focus/filter — screenshots in `docs/screenshots/stage-b/`
- [x] **(c)** person/union forms, date field with echo, context actions, delete with impact preview, union delete choices, merge, duplicates, warnings, undo buttons, multi-select — screenshots in `docs/screenshots/stage-c/`
- [x] **(d)** auto-layout with generations and clusters, null-position placement, re-arrange selection, snap-to-grid, alignment guides, jump-to-cluster — screenshots in `docs/screenshots/stage-d/`
- [x] **(e)** GEDCOM import (new / merge) and export, encodings, import report, raw preservation toggle — screenshots in `docs/screenshots/stage-e/`
- [x] **(f)** timeline and statistics with base populations, charts with data tables, historical layer — screenshots in `docs/screenshots/stage-f/`
- [x] **(g)** print dialog, preview, fit / tile, legibility warning, SVG / PNG export with embedded fonts, PDF instructions — screenshots in `docs/screenshots/stage-g/`
- [x] **(h)** first-run screen, guided start (resumable, one undo step), contextual tips, help page with printable quick start — screenshots in `docs/screenshots/stage-h/`
- [x] **(i)** manifest, service worker with prompt-style updates, update and offline notices, install entry with iOS instructions, offline verification — screenshots in `docs/screenshots/stage-i/`
- [x] **(j)** final accessibility audit, 500-person performance pass (with three rendering optimisations), README numbers, network verification, screen-reader checklist, deployment note — screenshots in `docs/screenshots/stage-j/`

## Known open points after stage (b)

- The layout engine reduces crossings with barycentre sweeps but does not eliminate them; marriages between two documented families still cross, which is inherent to a single-plane drawing.
- Black-and-white rendering of the branch stripes is implemented as SVG patterns and used by print in stage (g).

- Deployment: the workflow on `main` runs typecheck, lint, unit tests, build, budget and the Playwright suite before publishing; a red check blocks a broken deployment. CI needs Node 22 (jsdom 30 → undici 8) and the preview server bound to 127.0.0.1, both fixed after the first runs.
- The storage capacity is measured lazily the first time the Data view opens (a short probe write); until then the meter assumes 5 MB.

## Pending items that need the user

- [x] Technical plan approved (repository name / base path, font subsetting approach)
- [x] Design plan approved (typeface, card geometry, light-only theme)
- [x] Historical-context list confirmed (the eight proposed entries, no additions)
- [x] Copyright holder for the MIT `LICENSE`: h17t
- [ ] Manual screen-reader run (VoiceOver macOS/iOS, NVDA) — **pending**: the checklist is written in `docs/SCREEN_READER_CHECKLIST.md`; screen-reader support is not claimed until it has been run
- [x] First deployment — `main` created, Pages source set to GitHub Actions, the `github-pages` environment allows `main`; run #5 deployed successfully

## Screenshots

Stored under `docs/screenshots/stage-<x>/` at 360×640 and 1440×900 from stage (a) onwards.
