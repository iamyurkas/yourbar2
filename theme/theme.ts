import { MD3DarkTheme, MD3LightTheme, type PaperTheme } from '@/libs/react-native-paper';

export const palette = {
   primary: "#4DABF7",
    secondary: "#74C0FC",
    tertiary: "#A5D8FF",

    primaryContainer: "#D0EBFF",
    inversePrimary: "#E9F7DF",

    background: "#FFFFFF",
    surface: "#F8F9FA",
    outline: "#E5EAF0",
    outlineVariant: "#E9EEF4",
    surfaceVariant: "#EAF3F9",

    error: "#FF6B6B",
    errorContainer: "#FFE3E6",
    onError: "#FFFFFF",
    onErrorContainer: "#7A1C1C",

    onPrimary: "#FFFFFF",
    onBackground: "#000000",
    onSurface: "#303030ff",
    onSurfaceVariant: "#A1A1A1",

    disabled: "#CED4DA",
    placeholder: "#A1A1A1",
    backdrop: "rgba(0,0,0,0.4)",

  success: '#2E7D32',
  danger: '#D32F2F',
  tagPink: '#F06292',
  tagYellow: '#F4C430',
  tagTeal: '#26C6DA',
  tagPurple: '#9C27B0',
  tagOrange: '#FB8C00',
} as const;

const lightColors: PaperTheme['colors'] = {
  ...MD3LightTheme.colors,
  primary: palette.primary,
  onPrimary: '#FFFFFF',
  primaryContainer: '#D5E6FA',
  onPrimaryContainer: '#0B2A4A',
  secondary: palette.secondary,
  secondaryContainer: '#FFE9A6',
  onSecondary: '#2B1D00',
  onSecondaryContainer: '#3B2800',
  tertiary: palette.tertiary,
  tertiaryContainer: '#CBF1EC',
  onTertiary: '#003833',
  onTertiaryContainer: '#00302B',
  background: palette.background,
  surface: palette.surface,
  surfaceVariant: '#EEF2F8',
  outline: palette.outline,
  outlineVariant: '#E3E6EC',
  onSurface: '#1F2933',
  onSurfaceVariant: palette.onSurfaceVariant,
  onBackground: '#1F2933',
  error: palette.danger,
  errorContainer: '#FAD4D4',
  onError: '#FFFFFF',
  onErrorContainer: '#410E0B',
  inversePrimary: '#9CCAFF',
  inverseOnSurface: '#F7FAFF',
  inverseSurface: '#1F3142',
  surfaceDisabled: 'rgba(31,41,51,0.12)',
  onSurfaceDisabled: 'rgba(31,41,51,0.38)',
  backdrop: 'rgba(15,23,42,0.2)',
  elevation: {
    ...MD3LightTheme.colors.elevation,
    level0: 'transparent',
    level1: 'rgba(255,255,255,0.95)',
    level2: 'rgba(255,255,255,0.97)',
    level3: 'rgba(255,255,255,0.99)',
    level4: 'rgba(255,255,255,1)',
    level5: 'rgba(255,255,255,1)',
  },
};

const darkColors: PaperTheme['colors'] = {
  ...MD3DarkTheme.colors,
  primary: '#9CCAFF',
  onPrimary: '#001021',
  primaryContainer: '#1E3A5C',
  onPrimaryContainer: '#D8EAFF',
  secondary: '#FFD166',
  secondaryContainer: '#473000',
  onSecondary: '#221600',
  onSecondaryContainer: '#FFEBC0',
  tertiary: '#5ED4C6',
  tertiaryContainer: '#0C4039',
  onTertiary: '#00211D',
  onTertiaryContainer: '#BDF4EA',
  background: '#0D141C',
  surface: '#101820',
  surfaceVariant: '#1F2A36',
  outline: '#3C4C5F',
  outlineVariant: '#2A3947',
  onSurface: '#E3E8EF',
  onSurfaceVariant: '#A9B4C0',
  onBackground: '#E3E8EF',
  error: '#F28B82',
  errorContainer: '#4C1B1B',
  onError: '#2C0B0B',
  onErrorContainer: '#FADADB',
  inversePrimary: palette.primary,
  inverseOnSurface: '#101820',
  inverseSurface: '#E3E8EF',
  surfaceDisabled: 'rgba(227,232,239,0.16)',
  onSurfaceDisabled: 'rgba(227,232,239,0.38)',
  backdrop: 'rgba(5,12,20,0.5)',
  elevation: {
    ...MD3DarkTheme.colors.elevation,
    level0: 'transparent',
    level1: 'rgba(22,31,40,0.85)',
    level2: 'rgba(24,34,45,0.88)',
    level3: 'rgba(26,36,48,0.9)',
    level4: 'rgba(27,38,50,0.92)',
    level5: 'rgba(29,41,54,0.94)',
  },
};

export const lightTheme: PaperTheme = {
  ...MD3LightTheme,
  colors: lightColors,
};

export const darkTheme: PaperTheme = {
  ...MD3DarkTheme,
  colors: darkColors,
};

export type AppThemeMode = 'light' | 'dark';

export function getAppTheme(mode: AppThemeMode): PaperTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
