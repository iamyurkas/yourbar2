import { MD3LightTheme, type PaperTheme } from '@/libs/react-native-paper';

export const palette = {
  primary: '#4DABF7',
  primaryContainer: '#D5E6FA',
  onPrimary: '#FFFFFF',
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
  surface: '#F8F8F8',
  surfaceBright: '#FFFFFF',
  surfaceVariant: '#EEEEEE',

  outline: '#E5EAF0',
  outlineVariant: '#C4C4C4',

  onSurface: '#1F2933',
  onSurfaceMuted: '#5C6C7C',
  onSurfaceVariant: '#A1A1A1',
  onSurfaceDisabled: 'rgba(31,41,51,0.38)',
  onBackground: '#1F2933',

  inversePrimary: '#9CCAFF',
  inverseSurface: '#1F3142',
  inverseOnSurface: '#F7FAFF',

  error: '#D32F2F',
  errorContainer: '#FAD4D4',
  onError: '#FFFFFF',
  onErrorContainer: '#410E0B',

  success: '#2E7D32',
  danger: '#D32F2F',

  disabled: '#CED4DA',
  placeholder: '#A1A1A1',

  surfaceDisabled: 'rgba(31,41,51,0.12)',
  backdrop: 'rgba(15,23,42,0.2)',
  shadow: '#000000',

  highlightFaint: '#DCEFFE',
  highlightSubtle: '#4A90E21F',
  overlayOnPrimary: '#FFFFFF55',
} as const;

export const tagPalette = [
  '#ec5a5a',
  '#F06292',
  '#BA68C8',
  '#9575CD',
  '#7986CB',
  '#64B5F6',
  '#4FC3F7',
  '#4DD0E1',
  '#4DB6AC',
  '#81C784',
  '#AED581',
  '#DCE775',
  '#FFD54F',
  '#FFB74D',
  '#FF8A65',
  '#a8a8a8',
] as const;

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
