import { createContext, useContext } from 'react';
import { color } from '@/design/tokens';
import type { Palette } from '@/design/tokens';

/**
 * Which colour values the SVG components draw with. Print, SVG and PNG output render with the
 * default (the literal light palette); the on-screen canvas provides the CSS custom properties
 * so the drawing follows the theme.
 */
export const PaletteContext = createContext<Palette>(color);

export function usePalette(): Palette {
  return useContext(PaletteContext);
}
