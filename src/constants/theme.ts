/**
 * Design tokens for Stock Watch.
 *
 * Colors follow iOS grouped-table semantics (systemBackground / grouped
 * background / systemBlue) so screens read like Apple Stocks rather than a
 * custom dashboard. Financial semantics (`up`, `down`) stay in the palette so
 * gains and losses are never hardcoded at the call site.
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
    text: '#000000',
    textSecondary: '#3C3C43',
    textMuted: '#8E8E93',
    background: '#F2F2F7',
    backgroundElement: '#E5E5EA',
    backgroundSelected: '#D1D1D6',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: 'rgba(60, 60, 67, 0.12)',
    borderStrong: 'rgba(60, 60, 67, 0.29)',
    accent: '#007AFF',
    accentSoft: '#E5F1FF',
    accentText: '#FFFFFF',
    up: '#34C759',
    upSoft: '#E4F8EA',
    down: '#FF3B30',
    downSoft: '#FFE8E6',
    neutral: '#8E8E93',
    warning: '#FF9F0A',
    warningSoft: '#FFF4E0',
    overlay: 'rgba(0, 0, 0, 0.4)',
    skeleton: '#E5E5EA',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textMuted: '#8E8E93',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    surface: '#1C1C1E',
    surfaceElevated: '#1C1C1E',
    border: 'rgba(84, 84, 88, 0.36)',
    borderStrong: 'rgba(84, 84, 88, 0.65)',
    accent: '#0A84FF',
    accentSoft: '#0A2540',
    accentText: '#FFFFFF',
    up: '#30D158',
    upSoft: '#0F2A18',
    down: '#FF453A',
    downSoft: '#3A1210',
    neutral: '#8E8E93',
    warning: '#FFD60A',
    warningSoft: '#2A2408',
    overlay: 'rgba(0, 0, 0, 0.55)',
    skeleton: '#2C2C2E',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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
  lg: 12,
  xl: 18,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
