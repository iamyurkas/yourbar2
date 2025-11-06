/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const paletteLight = {
  primary: '#4DABF7',
  onPrimary: '#0A2A47',
  secondary: '#74C0FC',
  tertiary: '#A5D8FF',
  primaryContainer: '#E8F3FF',
  surface: '#FFFFFF',
  surfaceVariant: '#F4F8FC',
  outline: '#D6E0ED',
  outlineVariant: '#E5EDF7',
  text: '#1F2A37',
  mutedText: '#4B6479',
  icon: '#5B7B99',
  tabInactive: '#9CB8D6',
};

const paletteDark = {
  primary: '#74C0FC',
  onPrimary: '#051523',
  secondary: '#5AB0F5',
  tertiary: '#7FC6FF',
  primaryContainer: '#0D1A29',
  surface: '#101826',
  surfaceVariant: '#182132',
  outline: '#2D3B4D',
  outlineVariant: '#223142',
  text: '#F4F7FB',
  mutedText: '#A5B5C7',
  icon: '#90A7C2',
  tabInactive: '#6F87A5',
};

export const Colors = {
  light: {
    text: paletteLight.text,
    mutedText: paletteLight.mutedText,
    background: paletteLight.surface,
    surface: paletteLight.surface,
    surfaceVariant: paletteLight.surfaceVariant,
    outline: paletteLight.outline,
    outlineVariant: paletteLight.outlineVariant,
    primary: paletteLight.primary,
    onPrimary: paletteLight.onPrimary,
    secondary: paletteLight.secondary,
    tertiary: paletteLight.tertiary,
    primaryContainer: paletteLight.primaryContainer,
    tint: paletteLight.primary,
    icon: paletteLight.icon,
    tabIconDefault: paletteLight.tabInactive,
    tabIconSelected: paletteLight.primary,
  },
  dark: {
    text: paletteDark.text,
    mutedText: paletteDark.mutedText,
    background: paletteDark.surface,
    surface: paletteDark.surface,
    surfaceVariant: paletteDark.surfaceVariant,
    outline: paletteDark.outline,
    outlineVariant: paletteDark.outlineVariant,
    primary: paletteDark.primary,
    onPrimary: paletteDark.onPrimary,
    secondary: paletteDark.secondary,
    tertiary: paletteDark.tertiary,
    primaryContainer: '#14314A',
    tint: paletteDark.primary,
    icon: paletteDark.icon,
    tabIconDefault: paletteDark.tabInactive,
    tabIconSelected: paletteDark.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
