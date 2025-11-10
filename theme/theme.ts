import { MD3LightTheme, type PaperTheme } from '@/libs/react-native-paper';

export const palette = {
  primary: '#4DABF7',
  primaryContainer: '#D5E6FA',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#0B2A4A',

  secondary: '#74C0FC',
  secondaryContainer: '#E3F2FE',
  onSecondary: '#1F2B38',
  onSecondaryContainer: '#123B54',

  tertiary: '#A5D8FF',
  tertiaryContainer: '#D7EEFF',
  onTertiary: '#16354F',
  onTertiaryContainer: '#0C263A',

  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceBright: '#FFFFFF',
  surfaceVariant: '#EAF3F9',

  outline: '#D7E1EB',
  outlineVariant: '#E3EAF2',

  onSurface: '#303030',
  onSurfaceMuted: '#5C6C7C',
  onSurfaceVariant: '#A1A1A1',
  onSurfaceDisabled: 'rgba(48,48,48,0.32)',
  onBackground: '#303030',

  inversePrimary: '#9CCAFF',
  inverseSurface: '#1F3142',
  inverseOnSurface: '#F7FAFF',

  error: '#FF6B6B',
  errorContainer: '#FFE3E6',
  onError: '#601B28',
  onErrorContainer: '#5A1D2A',

  success: '#2E7D32',
  danger: '#FF6B6B',

  disabled: '#CED4DA',
  placeholder: '#A1A1A1',

  surfaceDisabled: 'rgba(31,41,51,0.12)',
  backdrop: 'rgba(15,23,42,0.25)',
  shadow: '#000000',

  highlightFaint: '#4DABF712',
  highlightSubtle: '#4DABF71F',
  overlayOnPrimary: '#FFFFFF55',
} as const;

export const tagColors = {
  default: '#E5E7EB',
  pink: '#F06292',
  yellow: '#F4C430',
  teal: '#26C6DA',
  purple: '#9C27B0',
  orange: '#FB8C00',
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
