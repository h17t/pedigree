# Decisions

Every assumption, chosen default and deviation from the brief, one line of rationale each.
Status column: **brief** = given in the brief, **proposed** = mine and awaiting your approval,
**accepted** = you approved it, **overruled** = you changed it (the new decision is added below it).

## Resolved in the brief

| # | Decision | Rationale | Status |
|---|---|---|---|
| 1 | Absolute base path from a single env-driven value; `base: './'` rejected. | A relative base cannot be reconciled with a service-worker scope and a PWA `start_url` on a project sub-path. | brief |
| 2 | CI and Pages deployment exist from stage (a); stage (j) is a final audit only. | Every stage must be verifiable on the real Pages URL, not only in the dev server. | brief |
| 3 | Hover previews permitted as a desktop enhancement with tap/keyboard/panel equivalents. | Hover may never be the only route to information or action. | brief |
| 4 | Four fixed card height variants; notes clamped, cards never grow. | The layout algorithm needs predictable packing; what you see must match what prints. | brief |
| 5 | Branch tags are colour plus label; a pattern substitutes for colour in B&W. | Nothing may be conveyed by colour alone. | brief |
| 6 | Two explicit print scale modes: fit-to-one-page and tiling. | Tiling is the realistic home-printer path for a large tree and the first alternative in the legibility warning. | brief |
| 7 | Sources: free text plus raw preservation, no structured `SOUR` records. | Structured citations are out of scope; raw preservation keeps round-trips valid. | brief |
| 8 | Generic `events[]` array in the model from day one. | Gramps and Ahnenblatt files carry baptism/burial/residence/emigration routinely; no later migration. | brief |
| 9 | Single `sex` field; `diverse` exports as `SEX X` plus `_GENDER diverse`. | Display/symbol concern only; `X` is not universally understood by older software. | brief |
| 10 | A death date forces `lifeStatus: deceased` and disables the control. | The two fields can never contradict each other. | brief |
| 11 | `position` is nullable; `null` means "not yet laid out". | Imported people must not stack at 0,0; the layout engine treats it as a first-class state. | brief |
| 12 | Zero-partner unions are legal and render as a labelled "Parents unknown" junction. | Sibling groups with unknown parents are real; the relationship must be visible, not implied. | brief |
| 13 | Layout, filters and generation counting break cycles defensively; validation stays non-blocking. | A cyclic tree must never hang, overflow or render nothing; the data is never changed. | brief |
| 14 | Undo via Immer patches, in memory only, cleared on project switch; bulk operations are single steps. | 50 snapshots of a 500-person tree is too much memory. | brief |
| 15 | Unreferenced top-level GEDCOM records preserved verbatim. | A dangling `@S1@` reference makes the exported file invalid for other software. | brief |
| 16 | Round-trip test asserts model equality, not byte equality. | Byte-identical output is not realistic; strict re-import is checked separately. | brief |
| 17 | Windows-1252 added to the supported import encodings. | The most common real-world case after UTF-8, often declared as `ANSI` by German desktop software. | brief |
| 18 | GEDCOM 7.0 out of scope, with a polite version-detection refusal. | A different grammar, not a superset. Candidate for a later feature. | brief |
| 19 | `customFields` exported as `_UDF`/`TEXT`, loss noted in the report. | Other software will most likely ignore them; the user is told. | brief |
| 20 | PNG output capped at 8 000 px on the long edge; oversized combinations disabled with an explanation. | A1 at 600 dpi (~14 000 × 20 000 px) fails silently in Chrome. | brief |
| 21 | SVG export embeds a subsetted WOFF2 rather than outlining text. | Outlining needs a font parser in the bundle and destroys selectable text; print shops handle embedded fonts routinely. | brief |
| 22 | PDF via browser print-to-PDF; no bundled generator. | A real generator plus embedded fonts would cost more than the remaining bundle budget. | brief |
| 23 | `@page` size is best-effort; the preview keeps the correct aspect ratio and the dialog explains the system-dialog settings. | Browser support for `@page size` is uneven. | brief |
| 24 | Multi-tab: first tab holds an edit lock with heartbeat; others are read-only with "Take over editing". | A last-write-wins race that destroys an afternoon of typing is the single worst failure. | brief |
| 25 | Backup reminder after 50 changes or 7 days, whichever comes first. | `localStorage` can be wiped by browser cleanup. | brief |
| 26 | Playwright added for browser-level tests and stage screenshots. | Service worker, offline, multi-tab and print preview cannot be covered by jsdom. | brief |
| 27 | axe-core in CI plus a manual screen-reader checklist that the user runs. | Screen-reader behaviour cannot be automated; support is not claimed until the checklist has been run. | brief |
| 28 | Hand-rolled typed i18n dictionary plus a custom ESLint rule; no i18next. | Interpolation and plurals are all that is needed; a typed object gives compile-time key safety. | brief |
| 29 | English is en-GB day-first, with an explicit date-format setting and always-visible interpretation echo. | Numeric slash dates are ambiguous; the echo removes the ambiguity for every user. | brief |
| 30 | Sample family and test fixture are the same artifact. | One source of truth; the awkward cases are realistic for a demo anyway. | brief |
| 31 | Returning users land on their last open project; first-run screen only when no project exists. | The empty screen is the hardest moment; returning users should never see it again. | brief |
| 32 | Photos, structured sources, GEDCOM 7 and a privacy filter for living people are out of scope. | Given in the brief; the model stays open for a later `photo` field (images would go to IndexedDB). | brief |

## Decided in the planning session (2026-09-13, approved by h17t)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 33 | Repository stays `pedigree`; default base path is `'/pedigree/'`. | The repo already exists under that name; the base is a one-line env override either way. | accepted |
| 34 | React 19, TypeScript 5 strict, Vite 7; CI pins Node 20 LTS. | Current stable releases; Vite 7 needs Node ≥ 20.19, which Node 20 LTS provides. | accepted |
| 35 | Zustand for state, custom Immer-patch undo stack outside React state. | Selector subscriptions keep drag frames cheap; patches keep undo small; no Redux boilerplate. | accepted |
| 36 | No router library; mode is mirrored to the URL hash. | Four modes and a few dialogs do not justify a dependency; the hash keeps back-button and `start_url` behaviour. | accepted |
| 37 | Custom generational layout; ELK and dagre rejected. | ELK is ~1 MB; dagre is unmaintained and has no notion of unions. | accepted |
| 38 | `vite-plugin-pwa` with `generateSW` and `registerType: 'prompt'`. | Workbox precache without a hand-written worker; prompt mode gives the update banner instead of auto-reload. | accepted |
| 39 | `TextDecoder` for UTF-8/UTF-16/Windows-1252, hand-written ANSEL table. | Native in all target browsers; `iconv-lite` would add ~150 KB. | accepted |
| 40 | Font: Atkinson Hyperlegible Next, weights 400/500/700, self-hosted WOFF2, OFL 1.1. Fallback Source Sans 3. | Designed for low-vision readers; OFL permits embedding in documents. | accepted |
| 41 | One typeface only; no serif for names. | Every exported SVG embeds the font; a second family doubles that cost and serif loses first at 6 pt. | accepted |
| 42 | Font subsetting for SVG export is chunk-level (build-time unicode ranges), not per-glyph. | Per-glyph subsetting needs a ~700 KB font compiler in the browser; chunks give 20–40 KB per weight with no parser. | accepted |
| 43 | Card geometry: width 220; heights 84 / 124 / 164 / 280; notes clamped to 4 lines in the tall variant. | Derived from the type scale; see design plan §3. Changing later re-runs every layout and print test. | accepted |
| 44 | `estimated` dates render as `~` on the card like `about`; the panel and legend spell out "estimated". | A fourth mark would not survive 6 pt print. | accepted |
| 45 | GEDCOM `BET`/`FROM` ranges and Julian/dual-year dates keep the verbatim value in `gedcomDate` on the event; export writes it back unless the user edited the date. | Lossless round-trip without model fields the UI cannot edit. | accepted |
| 46 | Sex marker follows pedigree-chart convention: square = male, circle = female, diamond = diverse, none = unknown. | A genealogical convention that survives black-and-white printing and does not rely on colour. | accepted |
| 47 | Deceased people: `†` before the death date plus a `slate` border instead of `ink`. | Two cues, neither is colour alone; not morbid. | accepted |
| 48 | Light theme only in v1. | Print previews and daylight reading; dark chrome can follow if requested. | accepted |
| 49 | Multi-tab lock heartbeat every 5 s, stale after 15 s. | Fast enough to notice a crashed tab, slow enough not to churn `localStorage`. | accepted |
| 50 | Autosave debounce 500 ms, flushed on `visibilitychange` and `pagehide`. | Keeps typing smooth and still saves before a tab is closed. | accepted |
| 51 | Historical context layer limited to the eight entries in design plan §7. | Minimal, Central/Western-European, labelled as orientation only; additions need the user's say. | accepted |
| 52 | Only Latin font chunks of two weights load at startup; Latin-Extended and the third weight load on demand. | Keeps the initial payload well under 500 KB. | accepted |
| 53 | MIT licence copyright holder is `h17t`. | The user's choice; the GitHub account name rather than a personal name. | accepted |
| 54 | Historical layer stays at the eight entries; Franco-Prussian War, post-1945 expulsion and the Berlin Wall are not added. | The user's choice: keep the layer minimal and closest to "orientation only". | accepted |

## Stage (a) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 55 | The sample family has 48 people, not 40. | Covering every case the brief lists (two marriages, divorce, separation, widowhood, unmarried and same-sex partnerships, adoption, foster child, unknown parents, disconnected family, isolated person, incomplete records) needed a few more people than 40; the test asserts 40–50. | decided |
| 56 | Vite 7 with `@vitejs/plugin-react` 5, although Vite 8 (Rolldown) is current. | Vite 8 shipped recently; the PWA plugin supports both, so an upgrade later is a version bump. Stability first. | decided |
| 57 | The navigation shows only the modes that exist at each stage. | A disabled "Tree" entry would be a placeholder, which the brief forbids. | decided |
| 58 | Outline list: partners are listed inline on the union row ("with Anna Weber") rather than as separate roots; a person under two unions is shown twice, the second time marked "also listed under". | Keeps one row per person in the normal case; adoptive links stay visible. | decided |
| 59 | Outline indentation is 12 px per level below 768 px and 34 px above. | Ten nesting levels are common; the wide indent alone exceeded a 360 px screen and made Chrome zoom out. A Playwright assertion now fails on any horizontal overflow. | decided |
| 60 | Storage capacity is measured lazily by a probe write the first time the Data view opens, then cached. | Browsers do not expose the localStorage quota; a one-time probe is cheaper than guessing wrongly. | decided |
| 61 | Status messages stay until dismissed and are announced politely; critical information is always also shown in place. | The brief forbids toasts that vanish before a slow reader is done. | decided |
| 62 | Date format setting defaults to day-first for both languages. | English is en-GB by decision 29; American users set month-first once. | decided |
| 63 | `sources` and `notes` stay free text; `customFields` render as labelled rows in the details panel. | As briefed; no structured citations. | decided |
| 64 | Playwright uses the sandbox's pre-installed Chromium only when `PLAYWRIGHT_SANDBOX_CHROMIUM=1`; CI installs the matching browser. | The sandbox browser revision differs from the Playwright release; CI must not depend on sandbox paths. | decided |

## Stage (b) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 65 | Dragging the empty canvas pans, on every pointer type; space+drag and middle mouse pan as well. Rubber-band selection (stage c) will use Shift+drag. | For the audience, "drag the picture to move it" is the expectation; hiding pan behind a modifier would be a hidden gesture. | decided |
| 66 | Touch never drags cards; a tap selects, a one-finger drag pans, two fingers pinch. | The brief makes dragging on phones optional and a drag-or-pan ambiguity on touch is a common source of accidental moves. | decided |
| 67 | People without a stored position get a provisional row placement computed on the fly and not written to the data. | The data keeps `position: null` ("not yet laid out") until the user moves a card or runs auto-layout in stage (d). | decided |
| 68 | Search selects the person and centres the viewport on them; there is no separate highlight style. | One visual state for "this is the person" is easier to learn than two. | decided |
| 69 | A double line is drawn as an 8 px ink stroke with a 4 px background stroke on top. | Works for any orthogonal path without offsetting geometry; the print module reuses it with the paper colour. | decided |
| 70 | The warning marker on a card is shown for every validation warning about that person, not only cycles. | Cycles must be marked; marking the other warnings the same way costs nothing and is consistent. | decided |
| 71 | Minimum zoom is 5 %, maximum 300 %. | The provisional layout of a large tree is wide; 10 % could not fit it on a phone. | decided |
| 72 | Mode, selection and filter changes are written to storage immediately; viewport changes are debounced. | A second tab or a reload must land where the user is; the viewport changes on every pan frame. | decided |
| 73 | Card text on screen is measured with a 2D canvas using the real font, with a per-glyph estimate as fallback (tests, font not yet loaded). | SVG has no automatic wrapping; measured widths keep truncation honest, and the fallback keeps the unit tests deterministic. | decided |

## Stage (c) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 74 | A new relative is created at once (one undo step) and the editor opens for them; cancelling the editor keeps the person, Undo removes them. | Matches "buttons name what happens": "Add child" adds a child. No half-created state, and the wizard in stage (h) can reuse the same path. | decided |
| 75 | New children inherit the father's surname, new partners of women start with an empty surname, new parents inherit the child's birth name or surname. | Sensible defaults for the German/English naming customs of the period; every value is editable. | decided |
| 76 | "Add child" for a person with several partnerships asks which family, with "other parent unknown" as an extra choice. | The brief's fast entry must not guess a parent. | decided |
| 77 | A union left with one partner after a deletion is kept as a single-partner union; with none and children as a "Parents unknown" group; with neither it is removed. | Exactly the brief's default behaviour; the preview lists each case in words. | decided |
| 78 | Removing a partnership keeps the children together as a "Parents unknown" sibling group by default; the second option drops the child links. | The brief's two options; keeping siblings together is the less destructive default. | decided |
| 79 | Merge default per field: the surviving record wins unless its value is empty; conflicts can be appended to the notes under a heading. | Nothing is lost without the user seeing it. | decided |
| 80 | Duplicate detection: same or near-same given name (edit distance ≤ 1) and surname or birth name, plus birth years within 2 years or unknown. | Cheap, explainable, few false positives; the reasons are shown in words. | decided |
| 81 | Editing happens in the same column (laptop) or sheet (phone) as the details, never in a modal. | Modals are hard on phones and hide the tree; the column keeps context. Confirmations and merges are modal because they need a decision. | decided |
| 82 | Undo/Redo buttons sit in the header on every screen size (icon plus text from tablet width up). | Always visible, as the brief requires, without stealing canvas space on phones. | decided |
| 83 | Multi-select is a laptop feature: Shift+click and Shift+drag; touch has no equivalent. | The brief scopes multi-select to desktop; every action it enables is also available one person at a time on phones. | decided |

## Stage (d) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 84 | Layout is a layered (Sugiyama-style) layout with couple blocks, not a recursive tree drawing. | A family graph is a DAG, not a tree: people have parents and partners from other documented families. | decided |
| 85 | Partners are raised to the deeper partner's generation; children always sit below both parents. | Keeps couples on one row and the "one row = one generation back" reading intact. | decided |
| 86 | A person with several partnerships sits between the partners, earlier marriages to the left. | Each junction stays between its two partners so child lines never cross a third person. | decided |
| 87 | Families are packed in a row up to four, then in a near-square grid, sorted by size. | Matches the brief; a long row of many tiny families would leave most of them off-screen. | decided |
| 88 | People without a stored position are laid out for display only (dotted outline) and persisted when the user arranges the tree, moves them, or the wizard/import runs the layout. | `position: null` keeps meaning "not yet laid out" until an explicit action; the display never stacks anyone at 0,0. | decided |
| 89 | "Arrange the whole tree" runs without a confirmation but is one undo step and says so in its hint. | The action is explicit and reversible; a confirmation would be friction for the common case. | decided |
| 90 | Alignment guides snap to the edges and centre of other cards within 6 screen pixels; snap-to-grid (20 units) replaces them when on. | Two snapping systems at once fight each other. | decided |
| 91 | Family frames are drawn only when there is more than one family. | A frame around the only family is noise. | decided |

## Stage (e) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 92 | `_MARNM` becomes the surname and the GEDCOM surname becomes the birth name. | The app shows the name a person used; the report says so. | decided |
| 93 | Shared NOTE records referenced by a person are copied into that person's notes and not preserved separately. | The text is what the user wants to read; keeping the record as well would duplicate it on export. | decided |
| 94 | Source citations by reference (`SOUR @S1@`) are preserved verbatim, including those inside BIRT/DEAT; on export they are written back under the mapped event. | Keeps exported files valid without structured citations in the model. | decided |
| 95 | Submitter records are regenerated on export rather than preserved. | The header must reference a submitter; regenerating avoids a dangling or duplicate one. | decided |
| 96 | Imported cross-reference ids are stored (`gedcomXref`) and reused on export when unique. | Preserved lines such as `ASSO @I5@` stay valid. | decided |
| 97 | Only the first NAME, BIRT and DEAT of a person are mapped; further ones are preserved raw. | The model has one of each; nothing is lost on a round trip. | decided |
| 98 | A file declared UTF-8 whose bytes are not valid UTF-8 is read as Windows-1252 and the report says so. | The most common mislabelling in practice. | decided |
| 99 | An invalid calendar date such as "31 FEB 1900" is kept verbatim with no interpreted date and listed under uncertain dates. | Never silently correct data. | decided |
| 100 | Merge-import adds everyone from the file without automatic matching; the duplicates list is the way to merge. | Automatic matching guesses; the brief asks for the merge UI. | decided |
| 101 | Import as a new tree runs the full layout and stores positions; merge-import places only the newcomers. | Imported people have `position: null` and must be placed; existing positions are never moved by an import. | decided |
| 102 | Exported partnerships are `MARR` with `TYPE partnership`; unmarried unions carry `_STAT unmarried`; same-sex couples are written as HUSB/WIFE with a note in the report. | GEDCOM 5.5.1 has no better representation. | decided |

## Stage (f) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 103 | The timeline draws people without a year of birth not at all and says how many there are. | A bar without a start would be a guess. | decided |
| 104 | "Unknown" life status without a death date is drawn as a short (10-year) faded, dashed bar. | Visibly distinct from both "living" (open to today) and "deceased" without pretending to know a lifespan. | decided |
| 105 | Age at death and life expectancy use only people with both a year of birth and a year of death; ages outside 0–120 are excluded. | Never infer death from a missing date; implausible spans would distort averages. | decided |
| 106 | Age at marriage counts each person's first dated marriage only. | "Age at marriage" for a person is one number; later marriages would double count. | decided |
| 107 | Charts are single-series bars with direct value labels and no legend; the one three-series chart (all/male/female) has a legend, direct labels and a hatch pattern on the third series. | Identity never rests on colour alone; a table sits behind every chart. | decided |
| 108 | The three-series chart uses a validated trio (#178A5C, #2456C4, #B3741A with a hatch): the design's muted green and ink failed the chroma checks of the palette validator when used as series colours. | Series colours must be distinguishable for colour-blind readers; labels and the pattern carry identity as well. | decided |
| 109 | The historical layer is drawn as pale bands with small labels above the year axis, in the active language. | Recessive background, never competing with the bars. | decided |

## Stage (g) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 110 | Print output is a nested `<svg>` with a `viewBox` mapped onto the printable area; the page margin in `@page` is 0 and the margins are drawn by the app. | Keeps the sheet geometry identical in the preview, on paper and in the exported file, without CSS transforms. | decided |
| 111 | The SVG file in tiling mode contains the whole drawing at 100 % as one sheet whose size follows the drawing. | Tiling is a home-printer workaround; a print shop wants the whole poster in one file. | decided |
| 112 | The PNG export renders the currently previewed sheet at the chosen dpi. | One image per sheet keeps the cap meaningful; for large posters the SVG route is recommended. | decided |
| 113 | The timeline and statistics sheets are always fit-to-one-page. | Their layout is a list, not a poster; tiling would cut rows. | decided |
| 114 | Fonts embedded in SVG exports are the Fontsource WOFF2 chunks (Latin, Latin Extended) for the weights used, selected by scanning the exported text. | Decision 42: chunk-level subsetting without a font compiler; OFL 1.1 permits embedding. | decided |
| 115 | Sheet 1 of a tiled print carries a small assembly plan in the top-left corner of the drawing area. | The brief asks for an assembly diagram; the corner keeps it away from the crop marks. | decided |


## Stage (h) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 116 | The guided start creates its own tree ("My family") and writes the people through the same edit functions as the editor, as one undo step that also includes the layout. | The result is indistinguishable from manual entry; one Undo removes everything if the user changes their mind. | decided |
| 117 | The wizard draft is saved to localStorage on every change and carries the id of its tree; the empty tree's "Start with yourself" button and the project list's "Continue the guided start" notice both resume it. | Leaving mid-way must lose nothing; a returning user lands on the tree, so the tree must offer the way back. | decided |
| 118 | Wizard people carry a year of birth only (no full dates, no places); the partner step asks for the kind of relationship and a year of marriage. | The brief wants the first entry quick; everything else is one click away in the editor. | decided |
| 119 | Contextual tips are a small store with a single active hint and a persisted dismissal list; they are offered by the views when their situation arises and rendered as an overlay in the canvas corner. | One tip at a time, attached to the canvas the tip talks about, never a tour. | decided |
| 120 | The help page is one page with a printable quick start on top; printing adds a body class that hides everything except the quick start panel. | The brief asks for a one-page quick start that can be printed; reusing the browser's print dialog avoids a second print pipeline. | decided |
| 121 | Help texts live in the typed dictionaries, so the initial bundle grows by about 8 KB gzipped for both languages. | Keeps the one-dictionary parity check; the help view itself is a lazy chunk. | decided |

## Stage (i) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 122 | The service worker precaches the entire build and serves navigations from the cached shell; there is no runtime caching because the app makes no runtime requests. | Everything the app needs is known at build time; a precache is the simplest correct strategy and the update is atomic. | decided |
| 123 | Updates are prompt-style: the new worker waits (no `skipWaiting`, no `clientsClaim`) until the user presses "Reload now"; "Later" hides the notice for this session. | The brief forbids silent updates and reloads while someone is editing; the data is in localStorage and is never touched by an update. | decided |
| 124 | The service worker is registered from the entry module (`injectRegister: null`) rather than an extra script tag. | Keeps the registration and the store together and one request fewer at startup. | decided |
| 125 | Icons are rendered from the SVG mark by a script using the bundled Chromium; the maskable icon is the mark at 62 % on a solid green square. | No image library in the toolchain; the safe zone of maskable icons is the inner 80 % circle. | decided |
| 126 | Playwright verifies offline use by reloading the app with the context offline after the worker has taken control, and verifies data safety by comparing every `pedigree:*` key before and after an update pass. | The brief asks for an "offline session" test and an "update keeps data" test; a real version switch is not possible in one build, but the invariant (the worker never touches localStorage) holds by construction. | decided |

## Stage (j) (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 127 | The canvas culls off-screen cards and simplifies zoomed-out text only above 150 visible cards; smaller trees keep every card in the DOM. | For small trees complete markup is better for keyboard and screen-reader users and for tests; for large trees rendering only what is visible is what keeps pan and zoom fluid. | decided |
| 128 | Below 40 % zoom a large tree draws only name and years per card, keeping the card box. | At that scale secondary text is under 5 px and unreadable; drawing it costs paint time for nothing. | decided |
| 129 | The card pointer handler reads the live viewport, positions and selection through a ref so its identity never changes. | A new handler per pan or zoom step defeated the card memoisation and re-rendered all cards on every frame. | decided |
| 130 | Performance is measured end to end by Playwright with the CPU throttled 4× through the DevTools protocol; the README quotes those numbers and the test asserts generous ceilings. | Reproducible in CI, includes the UI round trip, and catches regressions without certifying a particular device. | decided |
| 131 | The final audit lives in its own spec (`audit.spec.ts`) rather than being spread over the feature specs. | One place to see which states are covered; the feature specs keep their own targeted checks. | decided |
| 132 | Screen-reader support is not claimed until a person has run the checklist in `docs/SCREEN_READER_CHECKLIST.md`. | The brief forbids claiming what has not been verified. | decided |

## After first use (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 133 | No relationship state is assumed: a new partnership and a completed parent pair are "not recorded" (drawn as a single line) until the user sets the kind; the guided start asks for the parents' relationship with "not recorded" preselected and for each person's living / deceased / not known. | The first user reported that the guided start married the parents and made everyone living. The app must show what was entered, never a guess. | decided |
| 134 | Existing people are linked through one dialog (partner, child, parent, sibling) that lists impossible candidates with the reason instead of hiding them. | Users search by name and need to see why a name does not appear as a choice; the guards (same person, duplicate, ancestor loop, two parents) protect the model. | decided |
| 135 | Removing a person from a partnership or a family is a separate, undoable action that never deletes the person; the union survives as a "Parents unknown" group while it still has children. | Unlinking and deleting are different intents; the brief forbids destructive surprises. | decided |
| 136 | A person may have any number of partnerships; each is its own union, drawn as its own line, with its own status and dates. | Remarriage and successive partnerships are ordinary in family history. | decided |

## Balance generations (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 137 | "Balance generations" is a layout setting of the tree (off, gentle, strong), applied on screen and in print alike, rather than a print-only option. | The preview must match the canvas, and a card's size is part of its geometry (connectors, hit targets, drag, frames). | decided |
| 138 | The scale of a generation depends only on the head counts of its family's rows: target width = max(minimum scale × widest row, median row); rows narrower than the target stay at 100 %, wider rows shrink to it, never below the minimum (60 % gentle, 35 % strong). | Deterministic, survives manual moves and imports, and leaves families with evenly sized generations untouched. | decided |
| 139 | Changing the setting re-arranges the whole tree in the same undo step. | Stored positions assume the previous card sizes; without a re-arrangement cards would overlap. | decided |
| 140 | The setting is stored in the tree's settings (schema unchanged, missing value reads as "off"). | Backups and older trees keep loading; GEDCOM is unaffected. | decided |

## Usability pass (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 141 | All relationship editing happens in one "Family" panel under the person's name that shows the slots (father, mother, partners with their children, siblings) with "New person" / "Choose existing" next to each and "Remove" on each link. | Users could not see where parents go; a slot with two ways to fill it is self-explaining, and one place replaces four separate control groups. | decided |
| 142 | Removing one parent moves the child into a union with the remaining parent when siblings exist, otherwise the parent leaves the union. | "This is not my father" must not change the siblings' parents. | decided |
| 143 | The list mode is a flat alphabetical people list; the family outline is removed (it supersedes decision 24's outline). | The outline duplicated the tree and the Family panel, confused the first user, and its expand toggles were broken by a style override; a plain list is what people expect when searching for a name. | decided |
| 144 | Cards show no "living" label; only a death date or † appears. | A living person is the default reading of a card without a death date; the label added noise. | decided |
| 145 | The divorce mark is two strokes through the junction between the partners. | The gap between partner cards is the only place not covered by cards; a small slash beside the junction was invisible. | decided |
| 146 | "Close family" includes parents, siblings, children, grandparents, grandchildren and the person's own partners, never the partners of relatives; "Ancestors" is exactly the ancestors; "Descendants" keeps the descendants' partners. | The old rule added partners of everyone visible, which showed a partner's ex-partners and in-laws. | decided |

## Stage (k) (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 147 | Charts are computed from the data on every render and never stored; the canvas locks the cards in chart mode and the print dialog receives the chart's positions and lines. | One source of geometry for screen and paper; nothing on the main canvas changes when a chart is viewed. | decided |
| 148 | The pedigree chart is a dedicated left-to-right layout with orthogonal child→parent lines and no partnership junctions; the descendant chart reuses the generational engine on the descendant sub-graph with partners. | A pedigree reads by columns and has no need for junctions; a descendant chart is the main canvas restricted to one family line. | decided |
| 149 | A repeated ancestor (cousin marriage) is drawn once in the pedigree; the second branch ends there. | Positions are keyed by person; duplicating cards would double every ancestor above the repeat. | decided |
| 150 | The family sheet is plain HTML with inline CSS and no scripts, rendered from the same builder in the app's dialog, the print root and the saved file. | One report, three outputs, identical content; a saved file must open anywhere and carry nothing executable. | decided |

## Third round of use (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 151 | Names everywhere are "Given Surname (née Birthname)", localised ("geb." in German); the birth name is no longer a separate card line. | The user expects the maiden name with the name; a separate line was easy to miss. | decided |
| 152 | No junction markers on partnerships; the divorce mark stays; a single parent's children hang straight from the card. | The squares looked like data; the legend never explained them. | decided |
| 153 | Ranks are compacted downwards after longest-path ranking: everyone sits as low as their children allow, partners equalised, children kept below parents. | Parents belong directly above their children; the previous top-down ranks put a partner's parents next to the other side's grandparents. | decided |
| 154 | Layout order is fully deterministic: members, siblings and roots by birth date, then surname and given names, then id; partners by marriage date, then partner names. | The same tree must arrange the same way after any import or edit order. | decided |
| 155 | The final placement pass centres each sibling run under its parents' junction and widens the rows above (shifting parents and everything to their right) rather than pushing the run sideways. | Straight drops and buses that never cross cards; a complicated family becomes wider, which the user accepts. Crossings remain only where a family graph is not a tree (e.g. a partner from another drawn family); those buses get their own lane and a halo. | decided |
| 156 | Status messages: one row, newest message, plain messages fade after six seconds, warnings and errors stay, a log keeps the last thirty. | Stacked persistent notices hid the canvas. | decided |
| 157 | The print legend flows items into rows measured from the text length and returns its height. | Fixed columns overlapped long German labels. | decided |

## Stage (l) (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 158 | Schema version 2 replaces the per-person branch tag with tree-level colour groups (id, name, colour) and a `groupId` per person; the migration builds one group per distinct tag and keeps older files loadable. | The roadmap asks for named groups a person belongs to; a shared list is what makes renaming and the legend possible. | decided |
| 159 | The search panel matches every word of the query somewhere in the person's fields (names, places, occupation, notes, custom fields, events) and combines with the completeness filters; "Show only these" stores the result as a filter of ids. | One box for everything the user might remember; storing ids keeps the canvas filter simple and printable. | decided |
| 160 | The relationship calculator uses the nearest common ancestors (shortest combined distance, ties to the closer side) and treats in-laws as the partner of a relative or a relative of the partner, one step only. | Matches how people describe relationships; deeper in-law chains are not natural language. | decided |
| 161 | Relationship sentences are composed from dictionary terms per language; German terms carry their article and "Ur" is repeated in lower case after the first. | Correct German ("die Ururgroßmutter") needs language-specific composition rather than string concatenation. | decided |
| 162 | Spacing is a tree setting with three presets (compact 16/56, normal 40/80, wide 80/120 pixels between cards and between generations); changing it re-arranges the tree in the same undo step, and charts use the same gaps. | Large families became very wide; presets keep the drawing consistent and printable, and the setting travels with the file. | decided |

## Stage (m) (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 163 | Privacy is a per-person flag (`isPrivate`). "Hide private people" is a switch of each output: on by default for print, SVG/PNG and GEDCOM export, off by default on the canvas (a toolbar button, kept in the tree's view state). Hiding removes the person and their child links; a partner stays as a single parent, a childless partnership with a private partner disappears. | The roadmap's defaults; the person editing the tree must still see everyone, while anything leaving the device is safe unless deliberately switched off. Keeping the partner keeps the rest of the family connected. | decided |
| 164 | Undo keeps 200 steps. The store writes the patch history to sessionStorage together with the project's modification stamp and restores it only when the stamp of the loaded project matches; when the copy does not fit, the oldest half is dropped and the write retried. Applying a patch that no longer fits the state clears the history instead of throwing. | Survives a reload of the same tab without ever applying stale patches to a project changed in another tab; sessionStorage is per tab and per session, which is exactly the required scope. | decided |
| 165 | Date ranges are model fields: qualifiers `between` (BET … AND …) and `from` (FROM … TO …) with `dateEnd` next to `date`. The date field accepts "between/zwischen/bet X and/und Y", "from/von X to/bis Y", "X–Y", "X - Y", "X..Y" and "YYYY-YYYY"; the end must not lie before the start. Short form "1920–1925", long form a sentence per language; cards show the years "1920–1925" (one year when both fall in it). Earliest/latest day of a range come from its start/end for validation and the timeline. | The roadmap asks for real fields instead of the verbatim GEDCOM string, so ranges can be typed, shown and validated; GEDCOM BET/AND and FROM/TO now round-trip exactly. A lone FROM stays a range without end; a lone TO becomes "before" with the verbatim value kept. | decided |
| 166 | GEDCOM 7 files are read with the 5.5.1 reader plus the 7-specific pieces: version note in the report, SNOTE shared notes (top-level records and pointers), @VOID@ pointers skipped without counting as dangling, calendar words (GREGORIAN exact, others verbatim), BCE. Export stays 5.5.1. | The roadmap's minimum; the line grammar is the same, so a separate reader would only duplicate code. | decided |
| 167 | Warning thresholds: parent under 13 at the child's birth (biological or unknown links, judged by the parent's latest possible birth), marriage under 12 (was 14), age over 115 (was 120); death before birth as before. | The roadmap's numbers; adopted, step and foster children cannot trigger the parent-age warning, and a birth range should not cause false alarms. | decided |
| 168 | Cards and the list show "* 1878" for born beside "† 1950" for died; the card's spoken label says "born 1878, died 1950" (and "deceased" when there is no date). | User request; the genealogical convention the details and family sheet already used. Screen readers should not read symbols. | decided |

## Stage (n) (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 169 | Two palettes with the same roles (`color` light, `darkColor` dark) in tokens.ts, mirrored as CSS custom properties; the DOM and the on-screen SVG use the variables (`cssColor`, provided to the card, connector, junction and pattern components through a palette context), print/SVG/PNG and the family sheet use the literal light values, and `#print-root` re-declares the light variables so printed headers and legends never pick up the dark theme. | One source of truth for colours, a theme switch that cannot leak into paper output, and no duplicated components. | decided |
| 170 | Appearance is an app setting (system, light, dark; default system). "System" removes `data-theme` so `prefers-color-scheme` decides; a choice stamps `data-theme` on the root. The `theme-color` meta follows. | Matches the roadmap; the root attribute lets tests and CSS treat the three states plainly. | decided |
| 171 | Dark palette: ink #E6EBEF and slate #AEBAC6 on paper #1E262E / chrome #161C22 / ground #11161B (≥ 7:1 and ≥ 4.5:1), accents lightened (line #5FC4A8, select #8FB4FF, warn #F2B84B, danger #FF8C96) with dark tinted backgrounds; primary buttons keep `paper` as their text colour, which flips to dark on the light accent. Group stripe colours are unchanged (never text). | AA contrast in both themes, verified by axe on every view. | decided |
| 172 | Languages are registered in one table (`src/i18n/locales.ts`: code, Intl tag, native name, default name order). English is bundled; every other dictionary is a lazy chunk awaited before the first render and on a switch. A language ships only when its dictionary is complete: the type `Dictionary` and the parity test enforce the same keys, placeholders and non-empty leaves for every locale. | Twelve translations in the initial bundle would break the budget; a registry makes the language list and the defaults data rather than code. | decided |
| 173 | Plural leaves may carry zero/one/two/few/many/other; `translate` picks the Intl.PluralRules category and falls back to `other`. Polish and Russian provide few/many. | Correct counts in Slavic languages need more than one/other. | decided |
| 174 | Date parsing knows the month names, qualifier words (before or after the date) and range words of every shipped language plus the East Asian year-month-day forms; formatting uses Intl per language except the German numeric convention. | One date field for every language without a mode switch. | decided |
| 175 | Name order is an app setting (language default, given first, surname first) applied through `joinName`; CJK-only names join without a space. Korean, Japanese and Chinese default to surname first. Files (GEDCOM, backups) are untouched. | The roadmap's surname-first requirement for cards, lists and reports without touching the model. | decided |
| 176 | Cyrillic glyphs come from Noto Sans (OFL) chunks declared under the family name "Atkinson Hyperlegible Next" with unicode-range, loaded on demand and embedded in SVG exports when used. | Atkinson Hyperlegible Next ships Latin and Latin Extended only; a same-family range keeps one font stack everywhere. Deviation from the roadmap's wording noted. | decided |
| 177 | "Great" prefixes are composed per language: the prefix joins the last word of the term, articles stay in front (with French and Italian elision), Romance prefixes merge a doubled vowel ("tatara" + "abuelo"), and `great2` names the second step where a language has its own word. | Readable terms in ten languages from a handful of dictionary entries. | decided |
| 178 | East Asian fonts are Noto Sans JP/KR/SC as fontsource unicode-range chunks (400 and 700) under their own family names, with one stylesheet per family injected only when the language or the tree's names need it; the font stack puts the language's family first. Card text is measured again when a web font finishes loading; the estimate treats CJK glyphs as full-width. | Keeps the initial payload unchanged, downloads only the ranges shown, and gives Han ideographs the regional form. | decided |
| 179 | SVG exports embed only the Noto chunks whose ranges the drawing's characters use (the chunk table is fetched on demand); above 5 MB of embedded fonts the dialog says so and suggests PNG, but still saves. | Meets the roadmap's size rule without refusing the export. | decided |

## Follow-ups (2026-09-14)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 180 | "Select area" is a toolbar toggle (not a modifier key): while on, a plain drag on the background draws the selection rectangle with any pointer, a tap on the background clears the selection, and a finger can drag cards; panning falls back to two fingers, the middle button or Space. Shift+drag keeps working with the toggle off. | Touch screens have no Shift key, and a toggle with `aria-pressed` is discoverable; dragging a selected card already moved the group. | decided |
| 181 | The layout is a family-subtree layout: each couple block is owned by one parent block (the side with more descendants), siblings run from oldest to youngest across all of the parents' partnerships with each partner on the side of their children, subtrees are packed per row with contours so families never interleave, junctions are centred over their children, and in-law families are anchored above the person who married in (nearest clear shift). The barycentre sweeps are gone. | User request: children were not centred, children of several partnerships were grouped by partner, and families overlapped. A subtree with its own space is what people expect of a family tree; the compromise is that a couple with parents on both sides shows one family with a line across. | decided |
| 182 | Partner lines: a recorded partnership without marriage is a single solid line; only "relationship not recorded" is dashed (marriage double, divorced double with strokes). Legend, print legend and help follow. | User request: a dashed line reads as "uncertain", which fits the unrecorded case, not a known partnership. | decided |
| 183 | Removing a partner from a childless partnership removes the partnership record (a partnership with children keeps the remaining parent). Linking an existing person as the second parent puts the child into the pair's existing partnership when one exists instead of creating a second partnership of the same pair. | User report: an empty "partner not recorded" row stayed behind, and the same couple could end up with two partnerships. | decided |
