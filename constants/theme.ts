import { Platform } from 'react-native';

import { useTheme } from '@/libs/react-native-paper';
import { lightTheme, lightPalette, darkPalette } from '@/theme/theme';

const lightColors = lightTheme.colors;
const lightTintColor = lightColors.primary;

/**
 * @deprecated Use `useAppColors` hook instead for dark mode support.
 */
export const Colors = {
  ...lightColors,
  text: lightColors.onSurface,
  tint: lightTintColor,
  icon: lightColors.onSurfaceVariant,
  tabIconDefault: lightColors.onSurfaceVariant,
  tabIconSelected: lightTintColor,
  danger: lightPalette.danger,
  disabled: lightPalette.disabled,
  placeholder: lightPalette.placeholder,
  success: lightPalette.success,
} as const;

export const useAppColors = () => {
  const theme = useTheme();
  const colors = theme.colors;
  const tintColor = colors.primary;

  return {
    ...colors,
    dark: theme.dark,
    text: colors.onSurface,
    tint: tintColor,
    icon: colors.onSurfaceVariant,
    tabIconDefault: colors.onSurfaceVariant,
    tabIconSelected: tintColor,
  };
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
