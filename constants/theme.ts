import { Appearance, Platform } from 'react-native';

import { darkTheme, lightTheme, palette } from '@/theme/theme';

const colorScheme = Appearance.getColorScheme();
const activeTheme = colorScheme === 'dark' ? darkTheme : lightTheme;
const activeColors = activeTheme.colors;
const tintColor = activeColors.primary;

export const Colors = {
  ...activeColors,
  text: activeColors.onSurface,
  tint: tintColor,
  icon: activeColors.onSurfaceVariant,
  tabIconDefault: activeColors.onSurfaceVariant,
  tabIconSelected: tintColor,
  danger: palette.danger,
  disabled: palette.disabled,
  placeholder: palette.placeholder,
  success: palette.success,
} as const;

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
