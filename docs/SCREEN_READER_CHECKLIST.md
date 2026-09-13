# Manual screen-reader checklist

Automated checks (axe-core over every view and state, keyboard-only tests) pass, but a screen
reader is only proven by a person using one. This checklist is the handover for that run. Until it
has been completed, the README does not claim screen-reader support.

Run it with **VoiceOver on macOS (Safari)**, **VoiceOver on iOS (Safari)** and **NVDA on Windows
(Firefox or Chrome)**. Tick each row per reader; note anything that reads wrongly, is silent, or
traps focus. Expected announcements are given in English; the German build should read the same
in German.

| # | Where | Do | Expect | VO mac | VO iOS | NVDA |
|---|---|---|---|---|---|---|
| 1 | First run | Open the site fresh | "Welcome", heading level 1; three buttons read as "Start with yourself", "Look at the sample family", "Start an empty tree"; the restore button reads its label and hint | | | |
| 2 | First run | Tab from the top of the page | First stop is "Skip to content, link"; activating it moves focus into the main region | | | |
| 3 | Guided start | Start with yourself, move through the form | "Step 1 of 4" then heading "You" receives focus on each step change; every field reads its label; "Next" on an empty form reads the alert "Enter at least your given names or your surname" | | | |
| 4 | Guided start | Finish with 3–4 people | Status "Your tree was created with n people"; the canvas group is announced; the tip "Next: add grandparents" reads as a note with a "Got it" button | | | |
| 5 | Tree | Move into the canvas | Group "Family tree canvas. Use the list view for a keyboard-friendly outline."; each card reads "Name, years, button" with pressed state when selected | | | |
| 6 | Tree | Press Enter on a card | Card reads "pressed"; on a laptop the details region reads the name as a level-2 heading; on a phone the region "Selected: Name" is announced | | | |
| 7 | Tree | Open the legend | Section "Legend" with a level-2 heading; list items read the line styles | | | |
| 8 | Tree | Use "Show only › Ancestors of…" | The status bar reads "Showing: Ancestors of Name" and "n people hidden"; "Show everyone" restores | | | |
| 9 | List | Move through the outline | Tree structure with families as groups; "Show children" / "Hide children" buttons report expanded state; a person button reads "Name, years" | | | |
| 10 | Details | Open a person, activate Edit | Level-2 heading "Edit person" receives focus; each field reads its label; the date field reads the plain-language echo after typing | | | |
| 11 | Editing | Type an ambiguous date (e.g. 03.04.1920) | The echo reads the interpretation and offers "Read as … instead" as a button | | | |
| 12 | Delete | Delete a person | Dialog "Delete Name?" is announced as a dialog; the impact sentences are read; Escape closes without deleting | | | |
| 13 | Undo | Press Ctrl+Z after an edit | The status region announces what was undone; the Undo button reads its title "Undo: …" | | | |
| 14 | Warnings | Open "Show things to check" | Dialog "Things to check"; each item reads the sentence and the "Show Name" button | | | |
| 15 | Timeline | Open the timeline | Heading "Timeline"; the chart is a group with an accessible description; the data table is reachable and reads years per person | | | |
| 16 | Statistics | Open the statistics | Every figure reads its base population ("based on n people"); the chart tables are reachable | | | |
| 17 | Print | Open "Print & export" | Dialog title is announced; radio groups read their options; the legibility warning reads as an alert when triggered | | | |
| 18 | Data | Save a backup | Status "Backup file saved as …"; the storage meter reads "Using x of about y" | | | |
| 19 | Data | Switch language to German | The page language changes (the reader switches voice); all labels read in German | | | |
| 20 | Help | Open Help | Heading "Help"; the quick start is an ordered list of eight items; "Print this quick start" is a button | | | |
| 21 | Update notice | (When a new version is deployed) | The notice reads "A new version of Pedigree is ready" with "Reload now" and "Later" buttons; nothing reloads on its own | | | |
| 22 | Multi-tab | Open the same tree in a second tab | Banner "Read-only: another tab is editing" is read; the "Take over editing here" button works | | | |

## Result

- Date run:
- Readers and versions:
- Findings (row number, reader, what happened):
- Fixed in commit:
