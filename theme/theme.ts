import { MD3LightTheme, type PaperTheme } from '@/libs/react-native-paper';

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

export const lightTheme: PaperTheme = {
  ...MD3LightTheme,
  colors: lightColors,
};

export function getAppTheme(): PaperTheme {
  return lightTheme;
}
