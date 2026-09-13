# Design plan

Status: **approved 2026-09-13**. The **ASK** items were answered and are recorded in `DECISIONS.md`
(items 33–54); **ASSUMED** items are decisions I made and recorded there too. Section 8 is the self-critique the brief asks for.

A preview page with the palette, the type samples and the four card variants rendered as real SVG
accompanies this document (link in the status report).

## 1. Colour

Base palette (six named values):

| Token | Hex | Role |
|---|---|---|
| `ink` | `#1B2733` | All body text, card borders, connector lines, icons |
| `slate` | `#4A5A6A` | Secondary text (dates on cards, helper text, table captions) |
| `rule` | `#6F7C89` | Borders, dividers, grid dots, disabled text |
| `paper` | `#FFFFFF` | Cards, form fields, dialog surfaces |
| `chrome` | `#F3F4F2` | Toolbar, panels, bottom navigation |
| `ground` | `#E9EEEC` | Canvas background behind the tree |

Semantic colours:

| Token | Hex | Role |
|---|---|---|
| `line` | `#1E6B5A` | Primary actions, links, active nav item, focus ring |
| `select` | `#2456C4` | Selected card halo, selected list row, search hit highlight |
| `selectBg` | `#E4ECFB` | Fill behind a selected card / row |
| `warn` / `warnBg` | `#8A5A00` / `#FFF3D6` | Validation warnings, backup reminder, uncertainty notes |
| `danger` / `dangerBg` | `#A3212B` / `#FBE9EA` | Delete confirmations, unrecoverable errors |

Marks that are not colour: divorce is a struck-through double line, uncertainty is `~ < >` text,
death is `†`. These stay identical in black-and-white mode.

Branch-tag palette (always paired with a text label; in black-and-white mode the stripe becomes a pattern):

| Tag | Hex | On white | B&W pattern |
|---|---|---|---|
| green | `#1E6B5A` | 6.35 | solid |
| amber | `#8A5A00` | 5.93 | diagonal hatch |
| plum | `#7A3E9D` | 6.99 | dots |
| red | `#A3212B` | 7.47 | horizontal lines |
| steel | `#3A6B8A` | 5.75 | crosshatch |
| blue | `#2456C4` | 6.56 | vertical lines |

Contrast ratios (computed, WCAG 2.x):

| Pair | Ratio | Meets |
|---|---|---|
| ink on paper | 15.17 | AAA |
| ink on chrome | 13.75 | AAA |
| ink on ground | 12.93 | AAA |
| slate on paper | 7.09 | AAA |
| slate on chrome | 6.43 | AA (AAA large) |
| slate on ground | 6.05 | AA (AAA large) |
| rule on paper (borders, icons) | 4.27 | AA non-text (3:1) |
| rule on ground | 3.64 | AA non-text |
| paper on line (button text) | 6.35 | AA (AAA large) |
| paper on select | 6.56 | AA (AAA large) |
| select on selectBg | 5.52 | AA |
| warn on warnBg | 5.37 | AA |
| ink on warnBg | 13.75 | AAA |
| danger on paper | 7.47 | AAA |
| danger on dangerBg | 6.39 | AA |
| ink on dangerBg | 12.96 | AAA |

Rule: body-size text is only ever `ink` or `slate` on `paper`/`chrome`/`ground`, so it is always
≥ 6:1 and AAA on white. Coloured text (`line`, `select`, `warn`, `danger`) is reserved for
buttons, links and short status lines at 17 px medium weight or larger.

**ASSUMED**: light theme only in v1. A dark canvas is poor for print previews, and the audience
mostly reads in daylight. `prefers-color-scheme: dark` is respected for the chrome only if you ask
for it later.

## 2. Type

**One typeface: Atkinson Hyperlegible Next** (Braille Institute, SIL Open Font License 1.1).

Why this one: it was designed for readers with low vision, which describes a good share of the
audience, and its distinguishing forms (the tailed `l`, the open `a`, the distinct `I`/`1`) help
exactly where genealogy hurts: names and dates. It has enough weight range (we use three), has
German diacritics and `ß`, and the OFL permits embedding in exported SVG/PDF files. One face rather
than two because every exported SVG embeds the font, and a second family would double that cost
for a purely decorative gain.

Fallback if the Next release proves unsuitable in stage (a) (e.g. tabular figures missing or
metric quirks in the WOFF2 build): **Source Sans 3** (Adobe, OFL 1.1), same roles, same scale.

Weights used: **400** (regular, body), **500** (medium, buttons, labels, table headers),
**700** (bold, names on cards, headings). No 300 or lighter anywhere.

Type scale (px / line-height):

| Step | Size | Line | Weight | Used for |
|---|---|---|---|---|
| `xs` | 14 / 18 | 400 | Card notes in print `full` only; never in the UI chrome |
| `sm` | 15 / 20 | 400 | Card secondary lines (dates, occupation), dense table cells |
| `base` | 17 / 26 | 400 | Body text, form fields, list rows, buttons |
| `md` | 19 / 28 | 500 | Form section labels, panel titles |
| `lg` | 22 / 30 | 700 | Dialog titles, mobile page titles |
| `xl` | 26 / 34 | 700 | Page headings (help, first run) |
| `xxl` | 32 / 40 | 700 | First-run headline only |

Dates and years use tabular figures (`font-variant-numeric: tabular-nums`) so columns line up in
lists, cards and the timeline.

## 3. Card geometry (drives layout and print)

Units are SVG user units, equal to CSS px at 100 % zoom.

- **Width**: 220, fixed for every variant.
- **Border**: 1.5 `ink` stroke, 4 corner radius, no shadow. Deceased: border in `slate` and the `†` mark; both cues, never colour alone.
- **Branch stripe**: 6 wide along the left edge, inside the border, plus the tag label in 14 px medium at the bottom-left of the card when a tag is set. In B&W the stripe carries the pattern from §1.
- **Sex marker**: 10 × 10 glyph in the top-right corner following pedigree-chart convention: square = male, circle = female, diamond = diverse, nothing = unknown. The detail panel spells it out; the legend explains it.
- **Padding**: 10 all round, 12 on the left to clear the stripe.
- **Name**: 17 px bold, line-height 22, given names then surname, birth name as "née X" only at `full`. Wraps to at most two lines, then truncates with `…`; the full name is in the detail panel and in a desktop tooltip. The name block always reserves 44 units, so a one-line name does not change the height.
- **Secondary lines**: 15 px regular, line-height 20, one line each, truncated with `…`.

Height variants:

| Variant | Lines | Height | Used |
|---|---|---|---|
| `minimal` | name (2) + years line `1923 – 2001` | **84** | screen zoomed out, print minimal |
| `standard` | + `* 14.03.1923, Berlin` + `† 02.01.2001, Hamburg` + occupation | **124** | screen default, print standard |
| `full` | + birth name / nickname line + residence line | **164** | screen `full` |
| `tall` | `full` + two lines for other events / custom fields + 4 clamped note lines (14 / 18) + 4 separator | **280** | print `full` only |

Notes are clamped to **4 lines** in `tall`; the fourth line ends in `…` when more exists and the
legend carries "Notes are shortened on the card; the full text is in the file." A person's notes
never change the card height. Uncertain dates show `~1923`, `<1923`, `>1923`; **ASSUMED**
`estimated` also renders as `~` on the card with "(estimated)" spelled out in the panel and the
legend, because a fourth mark would not survive 6 pt print.

Union junction: a 12 × 12 point on the marriage line. Zero-partner unions render as a 120 × 32
rounded box labelled "Parents unknown" in 15 px medium, `slate` border, dashed.

Connectors: 2 `ink`. Marriage: double line (two 2-unit lines, 4 apart). Divorce: the same double
line with a short 45° strike at its midpoint. Unmarried/partnership: single dashed line.
Child lines drop from the union point: solid for biological, dashed for adopted, dotted for
step/foster, with the relation type also printed in the legend and in the panel.

Grid spacing for auto-layout and snap: 20 units; column gap 40, generation gap 80.

## 4. Layout

**Concept.** One persistent frame with the tree (or the outline list) as the large, calm centre
and everything else pushed to the edges. On a phone the edges are a bottom navigation bar and a
bottom sheet that slides up over the tree; on a laptop they become a left overview column and a
right detail column. The content area never has more than one floating element at a time.
Alignment: all chrome text left-aligned on a 16 px column grid; the tree canvas is edge-to-edge;
form labels sit above their fields (never beside, so 200 % zoom does not wrap them awkwardly);
buttons in a row are right-aligned with the primary action last, except on phones where the
primary action is a full-width 56 px bar at the bottom of the sheet.

Phone (360–430 px):

```
┌──────────────────────────────┐
│ Family of Anna Weber     ⋮ Menu│  56  project name + menu (text + icon)
├──────────────────────────────┤
│ 🔍 Search a person           │  48  search field, always visible
├──────────────────────────────┤
│                              │
│      ┌──────┐  ┌──────┐      │
│      │Card  ║══║Card  │      │  canvas: pinch, pan, tap
│      └──┬───┘  └──────┘      │
│         │                    │
│      ┌──┴───┐                │
│      │Card  │  (selected)    │
│      └──────┘                │
│                              │
│  [ Fit ] [ − ] [ + ]         │  48 px buttons, bottom-left
├──────────────────────────────┤
│ Anna Weber  1923 – 2001      │  selection bar, appears on select
│ [ Edit ] [ Add ▾ ] [ More ▾ ]│  56 px, labelled buttons
├──────────────────────────────┤
│ Tree │ List │ Time │ Stats │ Data │  bottom nav, 56 px, icon+label
└──────────────────────────────┘

Bottom sheet (Edit / Add / delete confirm), full height, own back button:
┌──────────────────────────────┐
│ ‹ Back      Edit person      │
│ Given names                  │
│ [Anna Maria               ]  │
│ Surname                      │
│ [Weber                    ]  │
│ Born                         │
│ [14.03.1923      ]           │
│ Understood as: 14 March 1923 │
│ ...                          │
├──────────────────────────────┤
│ [        Save changes       ]│  56 px, thumb reach
└──────────────────────────────┘
```

"List" in the bottom nav is the outline mode (indented, expand/collapse, same selection bar).
"Time" holds the timeline; "Stats" the statistics; "Data" holds projects, backup, settings,
storage usage, language and date format.

Laptop (1024 px+, shown at 1440):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Pedigree ▸ Family of Anna Weber    [Undo] [Redo]  [Add person ▾] [Auto-layout] [Print & export] [Help] │ 56
├────────────────┬─────────────────────────────────────────┬───────────────┤
│ 🔍 Search       │                                         │ Anna Weber    │
│ ─────────────  │        ┌──────┐   ┌──────┐              │ 1923 – 2001   │
│ ▾ Weber family │        │Card  ║═══║Card  │              │ ───────────── │
│   ▾ Karl Weber │        └──┬───┘   └──────┘              │ Given names   │
│     Anna Weber ◀│           │                             │ [Anna Maria ] │
│     Paul Weber │        ┌──┴───┐   ┌──────┐              │ Surname       │
│   ▸ Marie Koch │        │Card  │╌╌╌│Card  │              │ [Weber      ] │
│ ▸ Second family│        └──────┘   └──────┘              │ Born          │
│                │                                         │ [14.03.1923 ] │
│ ⚠ 2 warnings   │                                         │ Understood as │
│ ─────────────  │ [Fit] [−] [100 %] [+]   [Filter ▾] [Snap]│ ...           │
│ Tree · List ·  │                                         │ [Add ▾] [Delete]│
│ Timeline ·     │                                         │               │
│ Statistics ·   │                                         │               │
│ Data           │                                         │               │
└────────────────┴─────────────────────────────────────────┴───────────────┘
   280 px             flexible canvas                            360 px
```

Tablet (768–1023 px): canvas plus one side panel (the right one); the overview list becomes a
toggleable drawer from the left edge with a visible "Overview" button.

Every mode is reachable from the left column on laptop and the bottom bar on phone; nothing is
reachable only by gesture or shortcut.

## 5. Principles (what makes this look like genealogy, not a generic app)

1. **Ledger, not parchment.** White cards, ink rules, tabular figures and the printed-family-book
   symbols `*` and `†` that most German-speaking users already know. No textures, no sepia.
2. **Spend the boldness on the tree.** Cards have a firm 1.5 px ink border and the connectors are
   ink, doubled for marriage, so the structure reads from across a room. The chrome around it is
   two greys and one green.
3. **Generations are rows.** Auto-layout aligns cards to generation rows; the layout keeps the
   rows visible through consistent vertical spacing so "one row up = one generation back" holds.
4. **Time is drawn the same way everywhere.** The timeline uses the same ink bars and the same
   `~ < >` marks as the cards, and the statistics use the same branch colours, so a person looks
   the same in every view.
5. **Everything has a name.** Every control shows text, every mark is in the legend, every colour
   has a label. Nothing depends on knowing an icon.
6. **Quiet chrome, few corners.** 4 px radii on cards, 6 px on buttons and fields, one shadow only
   on floating sheets and menus. No card grid of identical shadowed boxes.

## 6. Motion

Only in response to an action, and only to show what changed: a sheet sliding up (200 ms), a newly
added card fading in at its position (150 ms), the viewport gliding to a search hit (250 ms), and an
undo briefly outlining the restored card. All of it collapses to instant under
`prefers-reduced-motion: reduce`. No entrance animations, no pulsing, no parallax.

## 7. Historical context layer (stage f) — **ASK**

Proposed final list, off by default, labelled "rough orientation, not a historical claim":

| Years | Label (en / de) |
|---|---|
| 1848–1849 | Revolutions of 1848 / Revolutionen von 1848 |
| 1846–1857 | First large emigration wave / Erste große Auswanderungswelle |
| 1864–1873 | Second emigration wave / Zweite Auswanderungswelle |
| 1880–1893 | Third emigration wave / Dritte Auswanderungswelle |
| 1914–1918 | First World War / Erster Weltkrieg |
| 1918–1920 | Influenza pandemic / Grippepandemie |
| 1939–1945 | Second World War / Zweiter Weltkrieg |
| 1990 | German reunification / Deutsche Wiedervereinigung |

Deliberately not included unless you say so: the Franco-Prussian War 1870–71, the post-1945 flight
and expulsion, and the Berlin Wall 1961–89. They are relevant to many families but each pushes the
layer further from "orientation" towards "narrative". The emigration wave years follow the
commonly cited peaks of German transatlantic emigration; they are approximate, as the note says.

## 8. Self-critique and what I changed

Reviewing the first draft of this plan against the two warnings in the brief:

- **Ground colour.** The first draft used a warm off-white (`#F7F5F0`) for the canvas because it
  felt "paper-like". That is the cream cliché by another name, and it lowered contrast for the
  slate text. Replaced with a cool neutral (`#E9EEEC`) that also makes white cards stand out.
- **Second typeface.** I had a serif for names on the cards to evoke record books. Dropped it: at
  6 pt print a serif loses first, it would add ≈ 25 KB per weight to every exported SVG, and
  serif-on-cream is exactly the default look the brief warns about. The subject-matter grounding
  now comes from the symbols, the tabular figures and the row structure instead.
- **Accent colours.** One teal was doing both "primary action" and "selected". Split into `line`
  (green, actions) and `select` (blue, state) so a selected card can never be mistaken for a
  button and vice versa. Terracotta and acid accents were never on the table.
- **Cards.** The first sketch had 8 px radii and a soft shadow on every card. Cut to 4 px and no
  shadow; the border does the work and the print output matches the screen exactly.
- **Headings.** Removed the small uppercase section labels I had above form groups; they are now
  19 px sentence-case labels, which is also what the 70+ audience reads faster.
- **Button text.** No trailing arrows or chevrons in button labels; a menu button shows `▾` as a
  separate, decorative glyph that the accessible name does not include.
- **Sex.** The first draft tinted cards by sex. Replaced by the pedigree-chart square/circle
  marker, which is a genealogical convention and survives black-and-white printing.
- **Selection bar on phone.** Initially a floating action button. Replaced with a full-width
  labelled bar, because a single round icon button breaks the "no icon-only controls" rule and is
  hard to explain to someone across the table.

Open design questions for you:

1. **ASK** Atkinson Hyperlegible Next as the single typeface, or would you prefer the more neutral
   Source Sans 3 from the start?
2. **ASK** Card width 220 and the four heights 84 / 124 / 164 / 280. Changing these later means
   re-running every layout and print test, so please decide now.
3. **ASK** Historical list in §7.
4. **ASK** Light theme only in v1.
