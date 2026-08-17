/**
 * Design tokens for Stock Watch.
 *
 * Colors are defined for light and dark mode and consumed through `useTheme()`.
 * Financial semantics (`up`, `down`) are part of the palette so gains and losses
 * are never hardcoded at the call site.
 */

import '@/global.css';

import { Platform } from 'react-native';

export type ThemeColors = {
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  up: string;
  upSoft: string;
  down: string;
  downSoft: string;
  neutral: string;
  warning: string;
  warningSoft: string;
  overlay: string;
  skeleton: string;
};

export type ThemeColor = keyof ThemeColors;

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    text: '#0B0D12',
    textSecondary: '#60646C',
    textMuted: '#8B8F98',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    surface: '#F7F8FA',
    surfaceElevated: '#FFFFFF',
    border: '#E4E6EB',
    borderStrong: '#CFD3DA',
    accent: '#2563EB',
    accentSoft: '#E8F0FE',
    accentText: '#FFFFFF',
    up: '#0E8A55',
    upSoft: '#E4F5EC',
    down: '#D02F45',
    downSoft: '#FDEAED',
    neutral: '#60646C',
    warning: '#B45309',
    warningSoft: '#FEF3C7',
    overlay: 'rgba(11, 13, 18, 0.45)',
    skeleton: '#E9EBEF',
  },
  dark: {
    text: '#F5F6F8',
    textSecondary: '#B0B4BA',
    textMuted: '#7E848E',
    background: '#0A0B0D',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    surface: '#14161A',
    surfaceElevated: '#1B1E23',
    border: '#26292F',
    borderStrong: '#383C44',
    accent: '#5B8DEF',
    accentSoft: '#16233B',
    accentText: '#08111F',
    up: '#3ECF8E',
    upSoft: '#10251C',
    down: '#F1657C',
    downSoft: '#2A1219',
    neutral: '#B0B4BA',
    warning: '#F5B54B',
    warningSoft: '#2A2010',
    overlay: 'rgba(0, 0, 0, 0.6)',
    skeleton: '#1F2226',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
})!;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
