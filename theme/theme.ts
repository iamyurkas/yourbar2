import { MD3LightTheme, type PaperTheme } from '@/libs/react-native-paper';

export const palette = {
  primary: '#4DABF7',
  primaryContainer: '#D9EDFF',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#0B375F',

  secondary: '#74C0FC',
  secondaryContainer: '#E6F3FF',
  onSecondary: '#0B375F',
  onSecondaryContainer: '#0B2A4A',

  tertiary: '#A5D8FF',
  tertiaryContainer: '#E8F4FF',
  onTertiary: '#0B375F',
  onTertiaryContainer: '#0B2A4A',

  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceBright: '#FFFFFF',
  surfaceVariant: '#EAF3F9',

  outline: '#E5EAF0',
  outlineVariant: '#E9EEF4',

  onSurface: '#303030',
  onSurfaceMuted: '#5C6C7C',
  onSurfaceVariant: '#A1A1A1',
  onSurfaceDisabled: 'rgba(48,48,48,0.38)',
  onBackground: '#303030',

  inversePrimary: '#9CCAFF',
  inverseSurface: '#1F3142',
  inverseOnSurface: '#F7FAFF',

  error: '#FF6B6B',
  errorContainer: '#FFE3E6',
  onError: '#FFFFFF',
  onErrorContainer: '#5B1317',

  success: '#2E7D32',
  danger: '#FF6B6B',

  disabled: '#CED4DA',
  placeholder: '#A1A1A1',

  surfaceDisabled: 'rgba(48,48,48,0.12)',
  backdrop: 'rgba(0,0,0,0.4)',
  shadow: '#000000',

  highlightFaint: 'rgba(77,171,247,0.08)',
  highlightSubtle: 'rgba(77,171,247,0.12)',
  overlayOnPrimary: '#FFFFFF55',
} as const;

export const tagColors = {
  default: '#E5E7EB',
  pink: '#FF8DAA',
  yellow: '#FFD76F',
  teal: '#5ED7D1',
  purple: '#B28DFF',
  orange: '#FFB46E',
} as const;

const lightColors: PaperTheme['colors'] = {
  ...MD3LightTheme.colors,
  primary: palette.primary,
  onPrimary: palette.onPrimary,
  primaryContainer: palette.primaryContainer,
  onPrimaryContainer: palette.onPrimaryContainer,
  secondary: palette.secondary,
  secondaryContainer: palette.secondaryContainer,
  onSecondary: palette.onSecondary,
  onSecondaryContainer: palette.onSecondaryContainer,
  tertiary: palette.tertiary,
  tertiaryContainer: palette.tertiaryContainer,
  onTertiary: palette.onTertiary,
  onTertiaryContainer: palette.onTertiaryContainer,
  background: palette.background,
  surface: palette.surface,
  surfaceVariant: palette.surfaceVariant,
  outline: palette.outline,
  outlineVariant: palette.outlineVariant,
  onSurface: palette.onSurface,
  onSurfaceVariant: palette.onSurfaceVariant,
  onBackground: palette.onBackground,
  error: palette.error,
  errorContainer: palette.errorContainer,
  onError: palette.onError,
  onErrorContainer: palette.onErrorContainer,
  inversePrimary: palette.inversePrimary,
  inverseOnSurface: palette.inverseOnSurface,
  inverseSurface: palette.inverseSurface,
  surfaceDisabled: palette.surfaceDisabled,
  onSurfaceDisabled: palette.onSurfaceDisabled,
  backdrop: palette.backdrop,
  elevation: {
    ...MD3LightTheme.colors.elevation,
    level0: 'transparent',
    level1: 'rgba(255,255,255,0.95)',
    level2: 'rgba(255,255,255,0.97)',
    level3: 'rgba(255,255,255,0.99)',
    level4: palette.surfaceBright,
    level5: palette.surfaceBright,
  },
};

export const lightTheme: PaperTheme = {
  ...MD3LightTheme,
  colors: lightColors,
};

export function getAppTheme(): PaperTheme {
  return lightTheme;
}
