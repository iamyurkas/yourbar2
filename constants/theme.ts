/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#243447',
    textMuted: '#5C7390',
    textSubtle: '#7E93AD',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceVariant: '#F4F7FB',
    primary: '#4DABF7',
    primaryContainer: '#E7F5FF',
    secondary: '#74C0FC',
    secondaryContainer: '#E3F2FF',
    tertiary: '#A5D8FF',
    tertiaryContainer: '#EDF6FF',
    outline: '#D4DFEB',
    outlineVariant: '#E8F0FA',
    tint: '#4DABF7',
    icon: '#4F6B88',
    tabIconDefault: '#8AA9C2',
    tabIconSelected: '#4DABF7',
    ripple: 'rgba(165,216,255,0.24)',
    success: '#4CC38A',
    warning: '#F4A261',
  },
  dark: {
    text: '#F4F9FF',
    textMuted: '#CFDAE8',
    textSubtle: '#A9B9CE',
    background: '#0F1A2A',
    surface: '#17263A',
    surfaceVariant: '#1F3146',
    primary: '#74C0FC',
    primaryContainer: '#1A3A5C',
    secondary: '#5AB0F5',
    secondaryContainer: '#1E3F60',
    tertiary: '#69B3FF',
    tertiaryContainer: '#1E3B56',
    outline: '#2D4864',
    outlineVariant: '#24374D',
    tint: '#74C0FC',
    icon: '#97B5D2',
    tabIconDefault: '#6D8AA7',
    tabIconSelected: '#74C0FC',
    ripple: 'rgba(116,192,252,0.28)',
    success: '#4CC38A',
    warning: '#F8C18C',
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
