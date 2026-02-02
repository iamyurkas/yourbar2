import { MD3LightTheme, MD3DarkTheme, type PaperTheme } from "@/libs/react-native-paper";

export const lightPalette = {
  primary: "#4DABF7",
  primaryContainer: "#D5E6FA",
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#0B2A4A",

  secondary: "#74C0FC",
  secondaryContainer: "#FFE9A6",
  onSecondary: "#2B1D00",
  onSecondaryContainer: "#3B2800",

  tertiary: "#A5D8FF",
  tertiaryContainer: "#CBF1EC",
  onTertiary: "#003833",
  onTertiaryContainer: "#00302B",

  background: "#FFFFFF",
  surface: "#F3F3F3",
  surfaceBright: "#FFFFFF",
  surfaceVariant: "#EEEEEE",

  outline: "#ffffff",
  outlineVariant: "#C4C4C4",

  onSurface: "#1F2933",
  onSurfaceMuted: "#5C6C7C",
  onSurfaceVariant: "#A1A1A1",
  onSurfaceDisabled: "rgba(31,41,51,0.38)",
  onBackground: "#1F2933",

  inversePrimary: "#9CCAFF",
  inverseSurface: "#1F3142",
  inverseOnSurface: "#F7FAFF",

  error: "#D32F2F",
  errorContainer: "#FAD4D4",
  onError: "#FFFFFF",
  onErrorContainer: "#410E0B",

  success: "#2E7D32",
  danger: "#D32F2F",

  disabled: "#CED4DA",
  placeholder: "#A1A1A1",

  surfaceDisabled: "rgba(31,41,51,0.12)",
  backdrop: "rgba(15,23,42,0.2)",
  shadow: "#000000",

  highlightFaint: "#DDEEFF",
  highlightSubtle: "#fff4dd",
  overlayOnPrimary: "#FFFFFF55",
} as const;

export const darkPalette: typeof lightPalette = {
  primary: "#9CCAFF",
  primaryContainer: "#1E2936",
  onPrimary: "#001529",
  onPrimaryContainer: "#D6E4FF",

  secondary: "#B0BEC5",
  secondaryContainer: "#1F2A36",
  onSecondary: "#0A141F",
  onSecondaryContainer: "#DCE4EA",

  tertiary: "#A5D8FF",
  tertiaryContainer: "#14202B",
  onTertiary: "#0B1721",
  onTertiaryContainer: "#DFF3FF",

  background: "#0B1017",
  surface: "#0F1720",
  surfaceBright: "#1B2733",
  surfaceVariant: "#1B2733",

  outline: "#3C4C5F",
  outlineVariant: "#2A3947",

  onSurface: "#E5EAF0",
  onSurfaceMuted: "#B7C1CC",
  onSurfaceVariant: "#A1A1A1",
  onSurfaceDisabled: "rgba(255,255,255,0.38)",
  onBackground: "#E5EAF0",

  inversePrimary: "#4A90E2",
  inverseSurface: "#E5EAF0",
  inverseOnSurface: "#122030",

  error: "#F28B82",
  errorContainer: "#3B121A",
  onError: "#3B121A",
  onErrorContainer: "#FADADB",

  success: "#81C784",
  danger: "#F28B82",

  disabled: "#3C4C5F",
  placeholder: "#707070",

  surfaceDisabled: "rgba(255,255,255,0.12)",
  backdrop: "rgba(0,0,0,0.6)",
  shadow: "#000000",

  highlightFaint: "#1E2936",
  highlightSubtle: "#1F2A36",
  overlayOnPrimary: "#00000055",
} as const;

// For backward compatibility
export const palette = lightPalette;

export const tagPalette = [
  "#ec5a5a",
  "#F06292",
  "#BA68C8",
  "#9575CD",
  "#7986CB",
  "#64B5F6",
  "#4FC3F7",
  "#4DD0E1",
  "#4DB6AC",
  "#81C784",
  "#AED581",
  "#CBD664",
  "#FFD54F",
  "#FFB74D",
  "#FF8A65",
  "#a8a8a8",
  "#707070",
] as const;

export const tagColors = {
  default: "#E5E7EB",
  pink: "#F06292",
  yellow: "#F4C430",
  teal: "#26C6DA",
  purple: "#9C27B0",
  orange: "#FB8C00",
} as const;

const lightColors: PaperTheme["colors"] = {
  ...MD3LightTheme.colors,
  primary: lightPalette.primary,
  onPrimary: lightPalette.onPrimary,
  primaryContainer: lightPalette.primaryContainer,
  onPrimaryContainer: lightPalette.onPrimaryContainer,
  secondary: lightPalette.secondary,
  secondaryContainer: lightPalette.secondaryContainer,
  onSecondary: lightPalette.onSecondary,
  onSecondaryContainer: lightPalette.onSecondaryContainer,
  tertiary: lightPalette.tertiary,
  tertiaryContainer: lightPalette.tertiaryContainer,
  onTertiary: lightPalette.onTertiary,
  onTertiaryContainer: lightPalette.onTertiaryContainer,
  background: lightPalette.background,
  surface: lightPalette.surface,
  surfaceBright: lightPalette.surfaceBright,
  surfaceVariant: lightPalette.surfaceVariant,
  outline: lightPalette.outline,
  outlineVariant: lightPalette.outlineVariant,
  onSurface: lightPalette.onSurface,
  onSurfaceMuted: lightPalette.onSurfaceMuted,
  onSurfaceVariant: lightPalette.onSurfaceVariant,
  onBackground: lightPalette.onBackground,
  error: lightPalette.error,
  errorContainer: lightPalette.errorContainer,
  onError: lightPalette.onError,
  onErrorContainer: lightPalette.onErrorContainer,
  inversePrimary: lightPalette.inversePrimary,
  inverseOnSurface: lightPalette.inverseOnSurface,
  inverseSurface: lightPalette.inverseSurface,
  surfaceDisabled: lightPalette.surfaceDisabled,
  onSurfaceDisabled: lightPalette.onSurfaceDisabled,
  backdrop: lightPalette.backdrop,
  highlightFaint: lightPalette.highlightFaint,
  highlightSubtle: lightPalette.highlightSubtle,
  overlayOnPrimary: lightPalette.overlayOnPrimary,
  elevation: {
    ...MD3LightTheme.colors.elevation,
    level0: "transparent",
    level1: "rgba(255,255,255,0.95)",
    level2: "rgba(255,255,255,0.97)",
    level3: "rgba(255,255,255,0.99)",
    level4: lightPalette.surfaceBright,
    level5: lightPalette.surfaceBright,
  },
};

const darkColors: PaperTheme["colors"] = {
  ...MD3DarkTheme.colors,
  primary: darkPalette.primary,
  onPrimary: darkPalette.onPrimary,
  primaryContainer: darkPalette.primaryContainer,
  onPrimaryContainer: darkPalette.onPrimaryContainer,
  secondary: darkPalette.secondary,
  secondaryContainer: darkPalette.secondaryContainer,
  onSecondary: darkPalette.onSecondary,
  onSecondaryContainer: darkPalette.onSecondaryContainer,
  tertiary: darkPalette.tertiary,
  tertiaryContainer: darkPalette.tertiaryContainer,
  onTertiary: darkPalette.onTertiary,
  onTertiaryContainer: darkPalette.onTertiaryContainer,
  background: darkPalette.background,
  surface: darkPalette.surface,
  surfaceBright: darkPalette.surfaceBright,
  surfaceVariant: darkPalette.surfaceVariant,
  outline: darkPalette.outline,
  outlineVariant: darkPalette.outlineVariant,
  onSurface: darkPalette.onSurface,
  onSurfaceMuted: darkPalette.onSurfaceMuted,
  onSurfaceVariant: darkPalette.onSurfaceVariant,
  onBackground: darkPalette.onBackground,
  error: darkPalette.error,
  errorContainer: darkPalette.errorContainer,
  onError: darkPalette.onError,
  onErrorContainer: darkPalette.onErrorContainer,
  inversePrimary: darkPalette.inversePrimary,
  inverseOnSurface: darkPalette.inverseOnSurface,
  inverseSurface: darkPalette.inverseSurface,
  surfaceDisabled: darkPalette.surfaceDisabled,
  onSurfaceDisabled: darkPalette.onSurfaceDisabled,
  backdrop: darkPalette.backdrop,
  highlightFaint: darkPalette.highlightFaint,
  highlightSubtle: darkPalette.highlightSubtle,
  overlayOnPrimary: darkPalette.overlayOnPrimary,
  elevation: {
    ...MD3DarkTheme.colors.elevation,
    level0: "transparent",
    level1: "rgba(15,23,32,0.7)",
    level2: "rgba(17,25,35,0.72)",
    level3: "rgba(19,27,38,0.74)",
    level4: darkPalette.surfaceBright,
    level5: darkPalette.surfaceBright,
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

export function getAppTheme(scheme?: 'light' | 'dark' | null): PaperTheme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}
