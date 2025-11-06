import { Platform } from 'react-native';

import { darkTheme, lightTheme } from '@/theme/theme';

const tintColorLight = lightTheme.colors.primary;
const tintColorDark = darkTheme.colors.primary;

export const Colors = {
  light: {
    text: lightTheme.colors.onSurface,
    background: lightTheme.colors.background,
    surface: lightTheme.colors.surface,
    surfaceVariant: lightTheme.colors.surfaceVariant,
    outline: lightTheme.colors.outline,
    outlineVariant: lightTheme.colors.outlineVariant,
    tint: tintColorLight,
    icon: lightTheme.colors.onSurfaceVariant,
    tabIconDefault: lightTheme.colors.onSurfaceVariant,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: darkTheme.colors.onSurface,
    background: darkTheme.colors.background,
    surface: darkTheme.colors.surface,
    surfaceVariant: darkTheme.colors.surfaceVariant,
    outline: darkTheme.colors.outline,
    outlineVariant: darkTheme.colors.outlineVariant,
    tint: tintColorDark,
    icon: darkTheme.colors.onSurfaceVariant,
    tabIconDefault: darkTheme.colors.onSurfaceVariant,
    tabIconSelected: tintColorDark,
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
