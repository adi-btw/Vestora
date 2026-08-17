/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ColorSchemeName = 'light' | 'dark';

export function useColorSchemeName(): ColorSchemeName {
  const scheme = useColorScheme();

  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): ThemeColors {
  return Colors[useColorSchemeName()];
}
