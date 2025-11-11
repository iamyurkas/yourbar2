import { MD3LightTheme, type PaperTheme } from '@/libs/react-native-paper';

export const palette = {
  primary: '#7F5AF0',
  primaryContainer: '#E8E2FF',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#20104B',

  secondary: '#2CB67D',
  secondaryContainer: '#D2F2E3',
  onSecondary: '#053323',
  onSecondaryContainer: '#0D4C38',

  tertiary: '#F7B733',
  tertiaryContainer: '#FFF1CF',
  onTertiary: '#3B2600',
  onTertiaryContainer: '#4F3200',

  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceBright: '#FFFFFF',
  surfaceVariant: '#E4E7EF',

  outline: '#D0D5DD',
  outlineVariant: '#B9C1D0',

  onSurface: '#1C2834',
  onSurfaceMuted: '#4B5565',
  onSurfaceVariant: '#7A8699',
  onSurfaceDisabled: 'rgba(28,40,52,0.38)',
  onBackground: '#1C2834',

  inversePrimary: '#B7A6FF',
  inverseSurface: '#1E2532',
  inverseOnSurface: '#F8F9FF',

  error: '#D84646',
  errorContainer: '#F9D1D1',
  onError: '#FFFFFF',
  onErrorContainer: '#410E0B',

  success: '#2FB36D',
  danger: '#D84646',

  disabled: '#D9DEE5',
  placeholder: '#9AA5B6',

  surfaceDisabled: 'rgba(28,40,52,0.12)',
  backdrop: 'rgba(15,23,42,0.25)',
  shadow: '#0F172A',

  highlightFaint: '#7F5AF01A',
  highlightSubtle: '#7F5AF029',
  overlayOnPrimary: '#FFFFFF55',
} as const;

export const tagColors = {
  default: '#DFE6FF',
  pink: '#FF8FA3',
  yellow: '#F7D98B',
  teal: '#4FD1C5',
  purple: '#CDB9FF',
  orange: '#FFB385',
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
