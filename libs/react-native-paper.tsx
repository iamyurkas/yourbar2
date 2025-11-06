import type { PropsWithChildren, ReactNode } from 'react';

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

type PaperProviderProps = PropsWithChildren<{
  theme?: PaperTheme;
}>;

export function PaperProvider({ children }: PaperProviderProps): ReactNode {
  return children;
}
