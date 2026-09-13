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

## Proposed in the planning session (2026-09-13)

| # | Decision | Rationale | Status |
|---|---|---|---|
| 33 | Repository stays `pedigree`; default base path is `'/pedigree/'`. | The repo already exists under that name; the base is a one-line env override either way. | proposed |
| 34 | React 19, TypeScript 5 strict, Vite 7; CI pins Node 20 LTS. | Current stable releases; Vite 7 needs Node ≥ 20.19, which Node 20 LTS provides. | proposed |
| 35 | Zustand for state, custom Immer-patch undo stack outside React state. | Selector subscriptions keep drag frames cheap; patches keep undo small; no Redux boilerplate. | proposed |
| 36 | No router library; mode is mirrored to the URL hash. | Four modes and a few dialogs do not justify a dependency; the hash keeps back-button and `start_url` behaviour. | proposed |
| 37 | Custom generational layout; ELK and dagre rejected. | ELK is ~1 MB; dagre is unmaintained and has no notion of unions. | proposed |
| 38 | `vite-plugin-pwa` with `generateSW` and `registerType: 'prompt'`. | Workbox precache without a hand-written worker; prompt mode gives the update banner instead of auto-reload. | proposed |
| 39 | `TextDecoder` for UTF-8/UTF-16/Windows-1252, hand-written ANSEL table. | Native in all target browsers; `iconv-lite` would add ~150 KB. | proposed |
| 40 | Font: Atkinson Hyperlegible Next, weights 400/500/700, self-hosted WOFF2, OFL 1.1. Fallback Source Sans 3. | Designed for low-vision readers; OFL permits embedding in documents. | proposed |
| 41 | One typeface only; no serif for names. | Every exported SVG embeds the font; a second family doubles that cost and serif loses first at 6 pt. | proposed |
| 42 | Font subsetting for SVG export is chunk-level (build-time unicode ranges), not per-glyph. | Per-glyph subsetting needs a ~700 KB font compiler in the browser; chunks give 20–40 KB per weight with no parser. | proposed |
| 43 | Card geometry: width 220; heights 84 / 124 / 164 / 280; notes clamped to 4 lines in the tall variant. | Derived from the type scale; see design plan §3. Changing later re-runs every layout and print test. | proposed |
| 44 | `estimated` dates render as `~` on the card like `about`; the panel and legend spell out "estimated". | A fourth mark would not survive 6 pt print. | proposed |
| 45 | GEDCOM `BET`/`FROM` ranges and Julian/dual-year dates keep the verbatim value in `gedcomDate` on the event; export writes it back unless the user edited the date. | Lossless round-trip without model fields the UI cannot edit. | proposed |
| 46 | Sex marker follows pedigree-chart convention: square = male, circle = female, diamond = diverse, none = unknown. | A genealogical convention that survives black-and-white printing and does not rely on colour. | proposed |
| 47 | Deceased people: `†` before the death date plus a `slate` border instead of `ink`. | Two cues, neither is colour alone; not morbid. | proposed |
| 48 | Light theme only in v1. | Print previews and daylight reading; dark chrome can follow if requested. | proposed |
| 49 | Multi-tab lock heartbeat every 5 s, stale after 15 s. | Fast enough to notice a crashed tab, slow enough not to churn `localStorage`. | proposed |
| 50 | Autosave debounce 500 ms, flushed on `visibilitychange` and `pagehide`. | Keeps typing smooth and still saves before a tab is closed. | proposed |
| 51 | Historical context layer limited to the eight entries in design plan §7. | Minimal, Central/Western-European, labelled as orientation only; additions need the user's say. | proposed |
| 52 | Only Latin font chunks of two weights load at startup; Latin-Extended and the third weight load on demand. | Keeps the initial payload well under 500 KB. | proposed |
