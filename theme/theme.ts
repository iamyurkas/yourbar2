import { MD3LightTheme, type PaperTheme } from "@/libs/react-native-paper";

export type ThemeScheme = "light" | "dark";

const lightPalette = {
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

const darkPalette = {
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
  surfaceBright: "#182330",
  surfaceVariant: "#1B2733",

  outline: "#3C4C5F",
  outlineVariant: "#2A3947",

  onSurface: "#E5EAF0",
  onSurfaceMuted: "#B7C1CC",
  onSurfaceVariant: "#9AA5B1",
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

  disabled: "#4B5563",
  placeholder: "#9AA5B1",

  surfaceDisabled: "rgba(255,255,255,0.12)",
  backdrop: "rgba(15,23,42,0.6)",
  shadow: "#000000",

  highlightFaint: "#1C2A3A",
  highlightSubtle: "#213246",
  overlayOnPrimary: "#00000055",
} as const;

export const palette = {
  light: lightPalette,
  dark: darkPalette,
} as const;

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

const baseColors = MD3LightTheme.colors;

const buildColors = (
  sourcePalette: typeof lightPalette | typeof darkPalette,
): PaperTheme["colors"] => ({
  ...baseColors,
  primary: sourcePalette.primary,
  onPrimary: sourcePalette.onPrimary,
  primaryContainer: sourcePalette.primaryContainer,
  onPrimaryContainer: sourcePalette.onPrimaryContainer,
  secondary: sourcePalette.secondary,
  secondaryContainer: sourcePalette.secondaryContainer,
  onSecondary: sourcePalette.onSecondary,
  onSecondaryContainer: sourcePalette.onSecondaryContainer,
  tertiary: sourcePalette.tertiary,
  tertiaryContainer: sourcePalette.tertiaryContainer,
  onTertiary: sourcePalette.onTertiary,
  onTertiaryContainer: sourcePalette.onTertiaryContainer,
  background: sourcePalette.background,
  surface: sourcePalette.surface,
  surfaceBright: sourcePalette.surfaceBright,
  surfaceVariant: sourcePalette.surfaceVariant,
  outline: sourcePalette.outline,
  outlineVariant: sourcePalette.outlineVariant,
  onSurface: sourcePalette.onSurface,
  onSurfaceMuted: sourcePalette.onSurfaceMuted,
  onSurfaceVariant: sourcePalette.onSurfaceVariant,
  onBackground: sourcePalette.onBackground,
  error: sourcePalette.error,
  errorContainer: sourcePalette.errorContainer,
  onError: sourcePalette.onError,
  onErrorContainer: sourcePalette.onErrorContainer,
  inversePrimary: sourcePalette.inversePrimary,
  inverseOnSurface: sourcePalette.inverseOnSurface,
  inverseSurface: sourcePalette.inverseSurface,
  surfaceDisabled: sourcePalette.surfaceDisabled,
  onSurfaceDisabled: sourcePalette.onSurfaceDisabled,
  backdrop: sourcePalette.backdrop,
  highlightFaint: sourcePalette.highlightFaint,
  highlightSubtle: sourcePalette.highlightSubtle,
  overlayOnPrimary: sourcePalette.overlayOnPrimary,
  shadow: sourcePalette.shadow,
  elevation: {
    ...baseColors.elevation,
    level0: "transparent",
    level1: sourcePalette.surface,
    level2: sourcePalette.surface,
    level3: sourcePalette.surfaceVariant,
    level4: sourcePalette.surfaceBright,
    level5: sourcePalette.surfaceBright,
  },
});

const lightColors = buildColors(lightPalette);
const darkColors = buildColors(darkPalette);

const lightThemeBase = {
  ...MD3LightTheme,
  colors: lightColors,
};

const darkThemeBase = {
  ...MD3LightTheme,
  colors: darkColors,
};

export const lightTheme: PaperTheme = lightThemeBase;

export const darkTheme: PaperTheme = darkThemeBase;

export function getPalette(scheme: ThemeScheme) {
  return palette[scheme];
}

export function getAppTheme(scheme: ThemeScheme): PaperTheme {
  return scheme === "dark" ? darkTheme : lightTheme;
}
