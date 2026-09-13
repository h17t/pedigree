/**
 * App-wide settings persisted under one key: language, date format, last open project and
 * the measured storage capacity.
 */
import { create } from 'zustand';
import { detectLocale, useLocaleStore } from '@/i18n';
import type { DateFormat, Locale } from '@/i18n';
import { KEY, readJson, setItem } from './storage';

export interface Settings {
  locale: Locale;
  dateFormat: DateFormat;
  lastOpenProjectId: string | null;
  storageCapacity: number | null;
  /** Explicitly chosen by the user (so navigator.language no longer overrides). */
  localeChosen: boolean;
}

const defaults = (): Settings => {
  const locale = detectLocale(typeof navigator !== 'undefined' ? navigator.language : undefined);
  return { locale, dateFormat: locale === 'de' ? 'dayFirst' : 'dayFirst', lastOpenProjectId: null, storageCapacity: null, localeChosen: false };
};

function load(): Settings {
  const r = readJson<Partial<Settings>>(KEY.settings);
  const d = defaults();
  if (!r.ok) return d;
  const s = { ...d, ...r.value };
  if (!s.localeChosen) s.locale = d.locale;
  return s;
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch);
    const { locale, dateFormat, lastOpenProjectId, storageCapacity, localeChosen } = get();
    setItem(KEY.settings, JSON.stringify({ locale, dateFormat, lastOpenProjectId, storageCapacity, localeChosen }));
    useLocaleStore.getState().setLocale(locale);
  },
}));

// Keep the i18n store in sync at startup.
useLocaleStore.getState().setLocale(useSettings.getState().locale);

export function setLocale(locale: Locale): void {
  useSettings.getState().update({ locale, localeChosen: true });
}
