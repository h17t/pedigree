import { useSyncExternalStore } from 'react';
import { useSettings } from '@/store/settings';

/** True when the media query matches; re-renders on change. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px)');

/**
 * Whether the dark palette is in force: the appearance setting, or the device when it is left
 * to follow the device. The canvas needs this because a card's tint is derived per theme.
 */
export function useIsDark(): boolean {
  const theme = useSettings((s) => s.theme);
  const deviceDark = useMediaQuery('(prefers-color-scheme: dark)');
  return theme === 'dark' || (theme === 'system' && deviceDark);
}
