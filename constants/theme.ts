import { Platform } from 'react-native';

import { lightTheme, palette } from '@/theme/theme';

const lightColors = lightTheme.colors;
const tintColor = lightColors.primary;

export const Colors = {
  ...lightColors,
  text: lightColors.onSurface,
  tint: tintColor,
  icon: lightColors.onSurfaceVariant,
  tabIconDefault: lightColors.onSurfaceVariant,
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
