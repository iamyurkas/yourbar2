import { MD3LightTheme, MD3DarkTheme, type PaperTheme } from "@/libs/react-native-paper";

export const lightPalette = {
  primary: "#4DABF7",
  primaryContainer: "#D5E6FA",
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#0B2A4A",

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

  secondary: "#625B71",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#E8DEF8",
  onSecondaryContainer: "#1D192B",

  tertiary: "#7D5260",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#FFD8E4",
  onTertiaryContainer: "#31111D",
} as const;

export const darkPalette = {
  primary: "#9CCAFF",
  primaryContainer: "#1E2936",
  onPrimary: "#001529",
  onPrimaryContainer: "#D6E4FF",

  background: "#0B1017",
  surface: "#0F1720",
  surfaceBright: "#1B2733",
  surfaceVariant: "#1B2733",

  outline: "#3C4C5F",
  outlineVariant: "#2A3947",

  onSurface: "#E5EAF0",
  onSurfaceMuted: "#B7C1CC",
  onSurfaceVariant: "#B7C1CC",
  onSurfaceDisabled: "rgba(255,255,255,0.38)",
  onBackground: "#E5EAF0",

  inversePrimary: "#4DABF7",
  inverseSurface: "#E5EAF0",
  inverseOnSurface: "#122030",

  error: "#F28B82",
  errorContainer: "#3B121A",
  onError: "#3B121A",
  onErrorContainer: "#FADADB",

  success: "#81C784",
  danger: "#F28B82",

  disabled: "#3C4C5F",
  placeholder: "#B7C1CC",

  surfaceDisabled: "rgba(255,255,255,0.12)",
  backdrop: "rgba(15,23,32,0.6)",
  shadow: "#000000",

  highlightFaint: "#1E2936",
  highlightSubtle: "#2C2100",
  overlayOnPrimary: "#00000055",

  secondary: "#B0BEC5",
  onSecondary: "#0A141F",
  secondaryContainer: "#1F2A36",
  onSecondaryContainer: "#DCE4EA",

  tertiary: "#A5D8FF",
  onTertiary: "#0B1721",
  tertiaryContainer: "#14202B",
  onTertiaryContainer: "#DFF3FF",
} as const;

/** @deprecated Use lightPalette or darkPalette instead */
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

function createTheme(baseTheme: PaperTheme, p: typeof lightPalette): PaperTheme {
  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: p.primary,
      onPrimary: p.onPrimary,
      primaryContainer: p.primaryContainer,
      onPrimaryContainer: p.onPrimaryContainer,

      secondary: p.secondary,
      onSecondary: p.onSecondary,
      secondaryContainer: p.secondaryContainer,
      onSecondaryContainer: p.onSecondaryContainer,

      tertiary: p.tertiary,
      onTertiary: p.onTertiary,
      tertiaryContainer: p.tertiaryContainer,
      onTertiaryContainer: p.onTertiaryContainer,

      background: p.background,
      surface: p.surface,
      surfaceBright: p.surfaceBright,
      surfaceVariant: p.surfaceVariant,
      outline: p.outline,
      outlineVariant: p.outlineVariant,
      onSurface: p.onSurface,
      onSurfaceMuted: p.onSurfaceMuted,
      onSurfaceVariant: p.onSurfaceVariant,
      onBackground: p.onBackground,
      error: p.error,
      errorContainer: p.errorContainer,
      onError: p.onError,
      onErrorContainer: p.onErrorContainer,
      inversePrimary: p.inversePrimary,
      inverseOnSurface: p.inverseOnSurface,
      inverseSurface: p.inverseSurface,
      surfaceDisabled: p.surfaceDisabled,
      onSurfaceDisabled: p.onSurfaceDisabled,
      backdrop: p.backdrop,
      highlightFaint: p.highlightFaint,
      highlightSubtle: p.highlightSubtle,
      overlayOnPrimary: p.overlayOnPrimary,
      danger: p.danger,
      success: p.success,
      disabled: p.disabled,
      placeholder: p.placeholder,
      elevation: {
        ...baseTheme.colors.elevation,
        level0: "transparent",
        level1: baseTheme === MD3LightTheme ? "rgba(255,255,255,0.95)" : "rgba(12,18,26,0.7)",
        level2: baseTheme === MD3LightTheme ? "rgba(255,255,255,0.97)" : "rgba(14,20,29,0.72)",
        level3: baseTheme === MD3LightTheme ? "rgba(255,255,255,0.99)" : "rgba(15,22,31,0.74)",
        level4: p.surfaceBright,
        level5: p.surfaceBright,
      },
    },
  };
}

export const lightTheme = createTheme(MD3LightTheme, lightPalette);
export const darkTheme = createTheme(MD3DarkTheme, darkPalette);

export function getAppTheme(isDark?: boolean): PaperTheme {
  return isDark ? darkTheme : lightTheme;
}
