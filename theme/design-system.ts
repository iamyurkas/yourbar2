import { Platform } from 'react-native';

import { Fonts } from '@/constants/theme';

const fallbackSans = Platform.OS === 'android' ? 'sans-serif' : 'System';
const fallbackMono = Platform.OS === 'android' ? 'monospace' : 'Courier';

const baseSans = Fonts?.sans ?? fallbackSans;
const rounded = Fonts?.rounded ?? baseSans;
const mono = Fonts?.mono ?? fallbackMono;

export const fontFamilies = {
  sans: baseSans,
  rounded,
  mono,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  helper: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: baseSans,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: baseSans,
    fontWeight: '400' as const,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: baseSans,
    fontWeight: '500' as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: baseSans,
    fontWeight: '600' as const,
  },
  chip: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: baseSans,
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: baseSans,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: baseSans,
    fontWeight: '500' as const,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: rounded,
    fontWeight: '600' as const,
  },
  headline: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: rounded,
    fontWeight: '700' as const,
  },
  mono: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: mono,
    fontWeight: '500' as const,
  },
} as const;

export type TypographyTokens = typeof typography;
