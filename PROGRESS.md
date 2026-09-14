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

Third round of use (2026-09-14): names show the birth name in brackets ("Anna Schuster (geb.
Wiese)") on cards, in the list, the details, the Family panel, the link dialog and the family
sheet; junction squares are gone from all partnerships (the lines say everything, and the legend
never showed squares); a single parent's children hang straight from the card; generations are
compacted so parents are always directly above their children and a partner who married in sits
level with their partner, not with the other side's grandparents; the layout is deterministic
(siblings by birth date, then name, then id; partners by marriage date, then name) whatever the
entry order; every sibling run is centred under its parents' junction and, when runs would
collide, the rows above are widened instead of pushing a run sideways, so lines stay straight and
never pass through a card; partners with cards between them are joined over the top; buses of
different families in the same gap take separate lanes, and every line carries a paper halo so
crossings read as tunnels; the print legend flows into rows measured from the text (it used to
overlap); status messages are one quiet row that fades after six seconds (warnings stay) with a
log of the last thirty. 210 unit tests pass.

## Roadmap stages (k)–(n)

Stage (k) delivered (2026-09-14): two chart modes in the Tree view, the ancestor chart (pedigree:
the person on the left, parents to the right, father above mother, each ancestor's row the middle of
its parents' rows, branch ends stacked, 4–8 generations, a repeated ancestor drawn once) and the
descendant chart (the person on top, descendants to a chosen depth with their partners, laid out by
the ordinary generational engine so partnerships and children look exactly as on the canvas).
Charts are computed from the data each time and never stored; the canvas draws them with locked
cards, the layout panel is hidden, and the print dialog offers "The chart as shown" and draws the
same positions and lines. The family sheet is a one-page report (fields, parents with their
relationship, siblings, partnerships with children and relation, events, notes, sources) shown in a
dialog, printed through the print root, and saved as a standalone HTML file without scripts.
206 unit tests and 98 Playwright tests pass.

Stage (l) delivered (2026-09-14): search across every field with the completeness filters (no
date of birth, deceased without a date of death, no parents, born between years, place contains),
a results list that jumps to a person and "Show only these on the canvas" as a filter of ids
(Ctrl+Shift+F opens the panel, Ctrl+F still jumps to a name); colour groups as schema version 2
(the per-person branch tags became a list of up to eight named groups of the tree, with a
migration that keeps every existing tag; a person is in one group or none; the group shows as the
card stripe with its name, in the legend and in the print legend with a black-and-white pattern;
managed on the Data page, chosen in the person editor, merged like any field); and the
relationship calculator (nearest common ancestors: direct line, full and half siblings, aunts,
uncles, nieces, nephews, cousins of any degree with removals, partners, partner of a relative,
relative of the partner) with plain-language sentences composed per language, including German
articles and "Ur"-prefixes. 214 unit tests and 104 Playwright tests pass.

Spacing (2026-09-14, after user feedback on wide families): a per-tree spacing setting in the
Layout panel (compact 16/56, normal 40/80, wide 80/120 pixels between cards / between generations;
default normal) that re-arranges the tree in one undo step and is stored with the tree; charts use
the same gaps. Sibling runs stay centred under their parents' junction in every setting.

Stage (m) delivered (2026-09-14): a **private** flag per person (editor checkbox, small lock on
the card) with "Hide private people" switches: on by default in the print dialog (print, SVG, PNG,
timeline and statistics sheets) and for the GEDCOM export (the report counts the people left out),
off by default on the canvas (toolbar button, stored with the tree's view state); partners and
children of a private person stay. **Undo** keeps 200 steps and a copy in the tab's session
storage keyed by the project's modification stamp, so a reload of the same tab restores the
history (a project changed elsewhere never gets a stale one; the copy halves itself when it does
not fit). **Date ranges** are model fields: qualifiers `between` and `from` with a `dateEnd`,
typed in the date field as "between 1920 and 1925", "zwischen … und …", "1920–1925", "from 1905 to
1962" or "von … bis …", echoed in plain language, shown as "1920–1925" on cards and lists and as
sentences in details, family sheet and reports; GEDCOM BET/AND and FROM/TO round-trip exactly
instead of being kept verbatim. **GEDCOM 7** files are read (version note in the report; SNOTE
shared notes, @VOID@ pointers, calendar words such as JULIAN, BCE); export stays 5.5.1.
**Warnings** now include a parent under 13 at a child's birth (biological or unknown links only;
the latest possible birth of a range counts), marriage under 12 (was 14) and an age over 115 (was
120); death before birth was already there. Cards and the list show "* 1878" for born next to
"† 1950" for died; the spoken card label says "born … died …". 249 unit tests and 112 Playwright
tests pass.

Stage (n), dark theme (2026-09-14): a second palette in `src/design/tokens.ts` (`darkColor`,
mirrored in `tokens.css` under `[data-theme="dark"]` and `prefers-color-scheme: dark` when
nothing is chosen), an **Appearance** setting on the Data page (same as the device / light /
dark, default system), and every on-screen colour through CSS custom properties: the canvas,
legend, timeline, statistics, dialogs and tips draw with `cssColor` (a palette context on the
SVG canvas), while print, SVG, PNG and the family sheet keep the literal light palette (the
print root re-declares the light variables). The browser theme colour follows. Axe passes on
every view in dark mode (list, details, editor, canvas with legend, print dialog, data,
timeline, statistics), on phone and desktop; dark screenshots in `docs/screenshots/stage-n/`.

Stage (n), languages batch 1 (2026-09-14): French, Spanish, Italian, Portuguese, Dutch, Polish,
Russian and Turkish as complete typed dictionaries (`src/i18n/<code>.ts`, each typed against the
English shape and checked by the parity test for keys, placeholders and empty leaves). English
stays in the initial bundle; every other dictionary is its own lazy chunk loaded before the first
render, so the initial JavaScript did not grow. The language list on the Data page is generated
from the registry in `src/i18n/locales.ts` (code, Intl tag, native name, default name order);
plural forms use the full Intl.PluralRules categories (Polish and Russian carry few/many). Dates:
month names, qualifier words (before/after the date) and range words for all eight languages,
plus East Asian forms (1923年3月14日, 1923년, 頃/约/경) ready for batch 2; formatting through Intl
per language. Relationship sentences compose "great" prefixes per language (arrière-, tatara-,
tris-, overover-, prapra-, прапра-, büyük büyük) with article and vowel handling. A **name order**
setting (language default / given first / surname first) drives cards, lists and reports through
one `joinName` helper; GEDCOM keeps given /surname/. Cyrillic text uses Noto Sans Cyrillic chunks
(7–22 KB each) declared under the same family name and loaded only when such text appears, because
Atkinson Hyperlegible Next has no Cyrillic glyphs; the SVG export embeds those chunks when used.

Stage (n), languages batch 2 (2026-09-14): Japanese, Chinese (simplified) and Korean as complete
dictionaries with surname-first name order by default (CJK-only names join without a space).
Fonts: Noto Sans JP/KR/SC (OFL) copied by `scripts/make-cjk-fonts.mjs` as fontsource chunks
(weights 400 and 700, ~120 unicode-range chunks per weight) into `public/fonts/cjk/` with one
stylesheet per family; a stylesheet is injected only when the language is ja/zh/ko or the open
tree's names contain Hangul, kana or Han (`src/design/cjkFonts.ts`), so the initial budget is
untouched and the browser fetches only the ranges on the page. The preferred family goes first in
the font stack so shared Han ideographs take the regional form. Text measurement re-runs when a web
font finishes loading (cards re-measure), and the estimate counts East Asian glyphs as full-width.
The SVG export fetches the chunk table on demand and embeds only the Noto chunks the drawing's
characters fall into; above 5 MB of embedded fonts it says so and points to PNG. The date field
reads 1923年3月14日 / 1923년 3월 14일 and 頃/约/경 qualifiers. Screenshots (Japanese canvas,
Russian list) in `docs/screenshots/stage-n/`.

Follow-up: the layout engine's ordering and coordinate steps were replaced by a family subtree
layout: every couple block hangs below exactly one parent block (a couple with parents on both
sides goes under the family with more descendants), siblings are ordered by birth across all of
the parents' partnerships with each partner on the side of their children, every family is packed
as a subtree with its own horizontal space (no interleaving, no overlaps), every partnership's
junction is centred over its children, and in-law families are placed above the person they
married into, shifted sideways only as far as the rows need. Ancestor-heavy trees come out as a
staircase of ancestor couples above their children rather than a symmetric pedigree; the ancestor
chart mode remains the symmetric view. Screenshots of the arranged sample at both viewports are in
`docs/screenshots/follow-ups/`.

Follow-up: the canvas reads the drag positions and the rubber band from refs on pointer up, so a
burst of pointer moves followed by the pointer up on a slow device no longer drops the move or
the selection; text cannot be selected inside the canvas and any selection left on the page is
cleared when a gesture starts, because a press on selected text made the browser start a native
text drag and cancel the card drag after its first move (both found by the browser tests on the
CI runner).

Follow-up (user reports): removing a partner from a childless partnership now removes the
partnership record instead of leaving an empty "partner not recorded" row; linking an existing
person as the second parent joins the pair's existing partnership rather than creating a second
one of the same couple; partner lines changed so that a recorded partnership without marriage is
a solid line and only "relationship not recorded" is dashed (legend, print legend and help
updated in all languages).

Follow-up: the "Select area" toggle in the Tree toolbar makes a plain drag on the background draw
the selection rectangle (mouse, pen and touch); dragging one of the selected cards moves the whole
group as one step. Shift+drag still works without the toggle.

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
- [x] **(l)** search and filters, colour groups (schema 2), relationship calculator — screenshots in `docs/screenshots/stage-l/`
- [x] **(k)** ancestor and descendant charts, family sheet — screenshots in `docs/screenshots/stage-k/`
- [x] **(n)** dark theme, eleven further languages in two batches with Cyrillic and lazy East Asian fonts, name order — screenshots in `docs/screenshots/stage-n/`
- [x] **(m)** privacy flag with hide switches, 200-step session undo, date ranges, GEDCOM 7 import, extended warnings — screenshots in `docs/screenshots/stage-m/`
- [x] **(j)** final accessibility audit, 500-person performance pass (with three rendering optimisations), README numbers, network verification, screen-reader checklist, deployment note — screenshots in `docs/screenshots/stage-j/`

## Known open points after stage (b)

- The layout engine draws every family as its own subtree, so lines cross only where a couple has documented parents on both sides (the second family is drawn above its child with a line across), which is inherent to a single-plane drawing.
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
