import { Platform } from 'react-native';

import { lightTheme, lightPalette } from '@/theme/theme';
import { useTheme } from '@/libs/react-native-paper';

export function useAppColors() {
  const theme = useTheme();

  return {
    ...theme.colors,
    text: theme.colors.onSurface,
    tint: theme.colors.primary,
    icon: theme.colors.onSurfaceVariant,
    tabIconDefault: theme.colors.onSurfaceVariant,
    tabIconSelected: theme.colors.primary,
    danger: theme.colors.danger ?? lightPalette.danger,
    disabled: theme.colors.disabled ?? lightPalette.disabled,
    placeholder: theme.colors.placeholder ?? lightPalette.placeholder,
    success: theme.colors.success ?? lightPalette.success,
  };
}

const lightColors = lightTheme.colors;

/** @deprecated Use useAppColors() hook instead for dynamic theme support */
export const Colors = {
  ...lightColors,
  text: lightColors.onSurface,
  tint: lightColors.primary,
  icon: lightColors.onSurfaceVariant,
  tabIconDefault: lightColors.onSurfaceVariant,
  tabIconSelected: lightColors.primary,
  danger: lightPalette.danger,
  disabled: lightPalette.disabled,
  placeholder: lightPalette.placeholder,
  success: lightPalette.success,
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
