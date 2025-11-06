import { MD3LightTheme, type PaperTheme } from '@/libs/react-native-paper';

export const palette = {
  primary: '#4DABF7',
  tint: '#4DABF7',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D5E6FA',
  onPrimaryContainer: '#0B2A4A',

  secondary: '#74C0FC',
  secondaryContainer: '#FFE9A6',
  onSecondary: '#2B1D00',
  onSecondaryContainer: '#3B2800',

  tertiary: '#A5D8FF',
  tertiaryContainer: '#CBF1EC',
  onTertiary: '#003833',
  onTertiaryContainer: '#00302B',

  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceVariant: '#EEF2F8',

  outline: '#E5EAF0',
  outlineVariant: '#E3E6EC',

  onSurface: '#1F2933',
  onSurfaceVariant: '#A1A1A1',
  onBackground: '#1F2933',

  text: '#1F2933',
  icon: '#A1A1A1',
  tabIconDefault: '#A1A1A1',

  error: '#D32F2F',
  errorContainer: '#FAD4D4',
  onError: '#FFFFFF',
  onErrorContainer: '#410E0B',

  inversePrimary: '#9CCAFF',
  inverseOnSurface: '#F7FAFF',
  inverseSurface: '#1F3142',

  surfaceDisabled: 'rgba(31,41,51,0.12)',
  onSurfaceDisabled: 'rgba(31,41,51,0.38)',
  backdrop: 'rgba(15,23,42,0.2)',

  success: '#2E7D32',
  danger: '#D32F2F',

  tagPink: '#F06292',
  tagYellow: '#F4C430',
  tagTeal: '#26C6DA',
  tagPurple: '#9C27B0',
  tagOrange: '#FB8C00',

  elevation: {
    level0: 'transparent',
    level1: 'rgba(255,255,255,0.95)',
    level2: 'rgba(255,255,255,0.97)',
    level3: 'rgba(255,255,255,0.99)',
    level4: 'rgba(255,255,255,1)',
    level5: 'rgba(255,255,255,1)',
  },
} as const;

const lightThemeColors: PaperTheme['colors'] = {
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
    ...palette.elevation,
  },
};

export const lightTheme: PaperTheme = {
  ...MD3LightTheme,
  colors: lightThemeColors,
};

export function getAppTheme(): PaperTheme {
  return lightTheme;
}
