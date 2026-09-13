/**
 * Historical context markers: a small, fixed, Central/Western-European set as agreed in the
 * design plan (§7). Off by default; labelled in the UI as a rough orientation aid, not a
 * historical claim. No data is fetched.
 */
export interface HistoryEntry {
  from: number;
  to: number;
  label: { en: string; de: string };
}

export const HISTORY: HistoryEntry[] = [
  { from: 1848, to: 1849, label: { en: 'Revolutions of 1848', de: 'Revolutionen von 1848' } },
  { from: 1846, to: 1857, label: { en: 'First large emigration wave', de: 'Erste große Auswanderungswelle' } },
  { from: 1864, to: 1873, label: { en: 'Second emigration wave', de: 'Zweite Auswanderungswelle' } },
  { from: 1880, to: 1893, label: { en: 'Third emigration wave', de: 'Dritte Auswanderungswelle' } },
  { from: 1914, to: 1918, label: { en: 'First World War', de: 'Erster Weltkrieg' } },
  { from: 1918, to: 1920, label: { en: 'Influenza pandemic', de: 'Grippepandemie' } },
  { from: 1939, to: 1945, label: { en: 'Second World War', de: 'Zweiter Weltkrieg' } },
  { from: 1990, to: 1990, label: { en: 'German reunification', de: 'Deutsche Wiedervereinigung' } },
];
