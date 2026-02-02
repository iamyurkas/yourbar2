import React, { createContext, useContext, type PropsWithChildren, type ReactNode } from 'react';

export type PaperTheme = {
  readonly version: number;
  readonly isV3: boolean;
  readonly roundness: number;
  readonly animation: {
    readonly scale: number;
  };
  readonly colors: {
    readonly primary: string;
    readonly primaryContainer: string;
    readonly secondary: string;
    readonly secondaryContainer: string;
    readonly tertiary: string;
    readonly tertiaryContainer: string;
    readonly surface: string;
    readonly surfaceVariant: string;
    readonly surfaceDisabled: string;
    readonly background: string;
    readonly error: string;
    readonly errorContainer: string;
    readonly onPrimary: string;
    readonly onPrimaryContainer: string;
    readonly onSecondary: string;
    readonly onSecondaryContainer: string;
    readonly onTertiary: string;
    readonly onTertiaryContainer: string;
    readonly onSurface: string;
    readonly onSurfaceVariant: string;
    readonly onSurfaceDisabled: string;
    readonly onError: string;
    readonly onErrorContainer: string;
    readonly onBackground: string;
    readonly outline: string;
    readonly outlineVariant: string;
    readonly inverseSurface: string;
    readonly inverseOnSurface: string;
    readonly inversePrimary: string;
    readonly shadow: string;
    readonly scrim: string;
    readonly backdrop: string;
    readonly onSurfaceMuted: string;
    readonly surfaceBright: string;
    readonly highlightFaint: string;
    readonly highlightSubtle: string;
    readonly overlayOnPrimary: string;
    readonly danger: string;
    readonly success: string;
    readonly disabled: string;
    readonly placeholder: string;
    readonly elevation: {
      readonly level0: string;
      readonly level1: string;
      readonly level2: string;
      readonly level3: string;
      readonly level4: string;
      readonly level5: string;
    };
  };
  readonly fonts: Record<string, Record<string, unknown>>;
};

export const MD3LightTheme: PaperTheme = {
  isV3: true,
  version: 3,
  fonts: {
    displayLarge: {},
    displayMedium: {},
    displaySmall: {},
    headlineLarge: {},
    headlineMedium: {},
    headlineSmall: {},
    titleLarge: {},
    titleMedium: {},
    titleSmall: {},
    labelLarge: {},
    labelMedium: {},
    labelSmall: {},
    bodyLarge: {},
    bodyMedium: {},
    bodySmall: {},
  },
  animation: {
    scale: 1,
  },
  roundness: 4,
  colors: {
    primary: '#6750A4',
    primaryContainer: '#EADDFF',
    secondary: '#625B71',
    secondaryContainer: '#E8DEF8',
    tertiary: '#7D5260',
    tertiaryContainer: '#FFD8E4',
    surface: '#FEF7FF',
    surfaceVariant: '#E7E0EC',
    surfaceDisabled: 'rgba(28,27,31,0.12)',
    background: '#FEF7FF',
    error: '#B3261E',
    errorContainer: '#F9DEDC',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#21005D',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#1D192B',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#31111D',
    onSurface: '#1C1B1F',
    onSurfaceVariant: '#49454F',
    onSurfaceDisabled: 'rgba(28,27,31,0.38)',
    onError: '#FFFFFF',
    onErrorContainer: '#410E0B',
    onBackground: '#1C1B1F',
    outline: '#79747E',
    outlineVariant: '#CAC4D0',
    inverseSurface: '#313033',
    inverseOnSurface: '#F4EFF4',
    inversePrimary: '#D0BCFF',
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(49,48,51,0.4)',
    elevation: {
      level0: 'transparent',
      level1: 'rgb(247,242,250)',
      level2: 'rgb(243,236,248)',
      level3: 'rgb(238,231,246)',
      level4: 'rgb(236,229,245)',
      level5: 'rgb(233,224,243)',
    },
  },
};

export const MD3DarkTheme: PaperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#9CCAFF',
    primaryContainer: '#1E2936',
    secondary: '#B0BEC5',
    secondaryContainer: '#1F2A36',
    tertiary: '#A5D8FF',
    tertiaryContainer: '#14202B',
    surface: '#0F1720',
    surfaceVariant: '#1B2733',
    surfaceDisabled: 'rgba(255,255,255,0.12)',
    background: '#0B1017',
    error: '#F28B82',
    errorContainer: '#3B121A',
    onPrimary: '#001529',
    onPrimaryContainer: '#D6E4FF',
    onSecondary: '#0A141F',
    onSecondaryContainer: '#DCE4EA',
    onTertiary: '#0B1721',
    onTertiaryContainer: '#DFF3FF',
    onSurface: '#E5EAF0',
    onSurfaceVariant: '#B7C1CC',
    onSurfaceDisabled: 'rgba(255,255,255,0.38)',
    onError: '#3B121A',
    onErrorContainer: '#FADADB',
    onBackground: '#E5EAF0',
    outline: '#3C4C5F',
    outlineVariant: '#2A3947',
    inverseSurface: '#E5EAF0',
    inverseOnSurface: '#122030',
    inversePrimary: '#4A90E2',
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(15,23,32,0.6)',
    elevation: {
      level0: 'transparent',
      level1: 'rgba(12,18,26,0.7)',
      level2: 'rgba(14,20,29,0.72)',
      level3: 'rgba(15,22,31,0.74)',
      level4: 'rgba(16,24,33,0.76)',
      level5: 'rgba(18,26,36,0.78)',
    },
  },
};

const ThemeContext = createContext<PaperTheme>(MD3LightTheme);

type PaperProviderProps = PropsWithChildren<{
  theme?: PaperTheme;
}>;

export function PaperProvider({ children, theme = MD3LightTheme }: PaperProviderProps): ReactNode {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
