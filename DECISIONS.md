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

