import {
  MD3DarkTheme,
  MD3LightTheme,
  type PaperTheme,
} from "@/libs/react-native-paper";

export type AppColorScheme = "light" | "dark";

export const palette = {
  light: {
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
    scrim: "#000000",

    highlightFaint: "#DDEEFF",
    highlightSubtle: "#fff4dd",
    overlayOnPrimary: "#FFFFFF55",
  },
  dark: {
    primary: "#9CCAFF",
    primaryContainer: "#1A2531",
    onPrimary: "#001529",
    onPrimaryContainer: "#D5E6FA",

    secondary: "#8FC9FF",
    secondaryContainer: "#1C2A3A",
    onSecondary: "#0A141F",
    onSecondaryContainer: "#DCE8F5",

    tertiary: "#9FD7FF",
    tertiaryContainer: "#152330",
    onTertiary: "#07141F",
    onTertiaryContainer: "#D7EEFF",

    background: "#0B1017",
    surface: "#0F1720",
    surfaceBright: "#1A2430",
    surfaceVariant: "#1B2733",

    outline: "#344354",
    outlineVariant: "#2A3947",

    onSurface: "#E5EAF0",
    onSurfaceMuted: "#B5C0CC",
    onSurfaceVariant: "#96A3AF",
    onSurfaceDisabled: "rgba(229,234,240,0.38)",
    onBackground: "#E5EAF0",

    inversePrimary: "#4DABF7",
    inverseSurface: "#E5EAF0",
    inverseOnSurface: "#122030",

    error: "#F28B82",
    errorContainer: "#3B121A",
    onError: "#3B121A",
    onErrorContainer: "#FAD4D4",

    success: "#63C66B",
    danger: "#F28B82",

    disabled: "#3B4653",
    placeholder: "#8C98A5",

    surfaceDisabled: "rgba(229,234,240,0.12)",
    backdrop: "rgba(15,23,32,0.6)",
    shadow: "#000000",
    scrim: "#000000",

    highlightFaint: "#1E2B3A",
    highlightSubtle: "#202A36",
    overlayOnPrimary: "#00000055",
  },
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

const buildColors = (
  baseTheme: PaperTheme,
  colorPalette: (typeof palette)[AppColorScheme],
): PaperTheme["colors"] => ({
  ...baseTheme.colors,
  primary: colorPalette.primary,
  onPrimary: colorPalette.onPrimary,
  primaryContainer: colorPalette.primaryContainer,
  onPrimaryContainer: colorPalette.onPrimaryContainer,
  secondary: colorPalette.secondary,
  secondaryContainer: colorPalette.secondaryContainer,
  onSecondary: colorPalette.onSecondary,
  onSecondaryContainer: colorPalette.onSecondaryContainer,
  tertiary: colorPalette.tertiary,
  tertiaryContainer: colorPalette.tertiaryContainer,
  onTertiary: colorPalette.onTertiary,
  onTertiaryContainer: colorPalette.onTertiaryContainer,
  background: colorPalette.background,
  surface: colorPalette.surface,
  surfaceBright: colorPalette.surfaceBright,
  surfaceVariant: colorPalette.surfaceVariant,
  outline: colorPalette.outline,
  outlineVariant: colorPalette.outlineVariant,
  onSurface: colorPalette.onSurface,
  onSurfaceMuted: colorPalette.onSurfaceMuted,
  onSurfaceVariant: colorPalette.onSurfaceVariant,
  onBackground: colorPalette.onBackground,
  error: colorPalette.error,
  errorContainer: colorPalette.errorContainer,
  onError: colorPalette.onError,
  onErrorContainer: colorPalette.onErrorContainer,
  inversePrimary: colorPalette.inversePrimary,
  inverseOnSurface: colorPalette.inverseOnSurface,
  inverseSurface: colorPalette.inverseSurface,
  surfaceDisabled: colorPalette.surfaceDisabled,
  onSurfaceDisabled: colorPalette.onSurfaceDisabled,
  backdrop: colorPalette.backdrop,
  highlightFaint: colorPalette.highlightFaint,
  highlightSubtle: colorPalette.highlightSubtle,
  overlayOnPrimary: colorPalette.overlayOnPrimary,
  shadow: colorPalette.shadow,
  scrim: colorPalette.scrim,
  elevation: {
    ...baseTheme.colors.elevation,
    level0: "transparent",
    level1: colorPalette.surfaceBright,
    level2: colorPalette.surfaceBright,
    level3: colorPalette.surfaceBright,
    level4: colorPalette.surfaceBright,
    level5: colorPalette.surfaceBright,
  },
});

const lightColors = buildColors(MD3LightTheme, palette.light);
const darkColors = buildColors(MD3DarkTheme, palette.dark);

export const lightTheme: PaperTheme = {
  ...MD3LightTheme,
  colors: lightColors,
};

export const darkTheme: PaperTheme = {
  ...MD3DarkTheme,
  colors: darkColors,
};

export function getAppTheme(colorScheme: AppColorScheme): PaperTheme {
  return colorScheme === "dark" ? darkTheme : lightTheme;
}

export function getPalette(colorScheme: AppColorScheme) {
  return palette[colorScheme];
}
