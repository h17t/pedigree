/**
 * App-wide settings persisted under one key: language, date format, last open project and
 * the measured storage capacity.
 */
import { create } from 'zustand';
import { detectLocale, useLocaleStore, surnameFirstDefault, isLocale } from '@/i18n';
import { setSurnameFirst } from '@/model/nameOrder';
import type { DateFormat, Locale } from '@/i18n';
import { darkColor, color } from '@/design/tokens';
import type { Theme } from '@/design/tokens';
import { KEY, readJson, setItem } from './storage';

export interface Settings {
  locale: Locale;
  dateFormat: DateFormat;
  lastOpenProjectId: string | null;
  storageCapacity: number | null;
  /** Explicitly chosen by the user (so navigator.language no longer overrides). */
  localeChosen: boolean;
  /** Appearance: follow the system, or always light or dark. */
  theme: Theme;
  /** Display order of names: the language's usual order, or a fixed choice. */
  nameOrder: NameOrder;
}
export type NameOrder = 'auto' | 'givenFirst' | 'surnameFirst';

const defaults = (): Settings => {
  const locale = detectLocale(typeof navigator !== 'undefined' ? navigator.language : undefined);
  return { locale, dateFormat: locale === 'de' ? 'dayFirst' : 'dayFirst', lastOpenProjectId: null, storageCapacity: null, localeChosen: false, theme: 'system', nameOrder: 'auto' };
};

function load(): Settings {
  const r = readJson<Partial<Settings>>(KEY.settings);
  const d = defaults();
  if (!r.ok) return d;
  const s = { ...d, ...r.value };
  if (!s.localeChosen) s.locale = d.locale;
  if (s.theme !== 'light' && s.theme !== 'dark') s.theme = 'system';
  if (s.nameOrder !== 'givenFirst' && s.nameOrder !== 'surnameFirst') s.nameOrder = 'auto';
  if (!isLocale(s.locale)) s.locale = d.locale;
  return s;
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch);
    const { locale, dateFormat, lastOpenProjectId, storageCapacity, localeChosen, theme, nameOrder } = get();
    setItem(KEY.settings, JSON.stringify({ locale, dateFormat, lastOpenProjectId, storageCapacity, localeChosen, theme, nameOrder }));
    applyNameOrder(locale, nameOrder);
    void useLocaleStore.getState().setLocale(locale);
    applyTheme(theme);
  },
}));

/**
 * Stamp the chosen theme on the root element (`data-theme`), or remove it so the system
 * preference decides, and keep the browser chrome colour in step.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? darkColor.chrome : color.chrome);
}

if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(useSettings.getState().theme));
}

export function applyNameOrder(locale: Locale, nameOrder: NameOrder): void {
  setSurnameFirst(nameOrder === 'auto' ? surnameFirstDefault[locale] : nameOrder === 'surnameFirst');
}

/** Loads the dictionary of the stored language and activates it; awaited before the first render. */
export async function startLocale(): Promise<void> {
  const { locale, nameOrder } = useSettings.getState();
  applyNameOrder(locale, nameOrder);
  await useLocaleStore.getState().setLocale(locale);
}

// Keep the theme in sync at startup (the language is started by main.tsx).
applyTheme(useSettings.getState().theme);

export function setLocale(locale: Locale): void {
  useSettings.getState().update({ locale, localeChosen: true });
}
