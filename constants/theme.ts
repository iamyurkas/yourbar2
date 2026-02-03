import { Platform, useColorScheme } from 'react-native';

import { lightTheme, darkTheme, lightPalette, darkPalette } from '@/theme/theme';
import { useInventory } from '@/providers/inventory-provider';

export function useAppColors() {
  const { appTheme } = useInventory();
  const systemColorScheme = useColorScheme();

  const isDark = appTheme === 'system'
    ? systemColorScheme === 'dark'
    : appTheme === 'dark';

  const theme = isDark ? darkTheme : lightTheme;
  const p = isDark ? darkPalette : lightPalette;

  return {
    ...theme.colors,
    text: theme.colors.onSurface,
    tint: theme.colors.primary,
    icon: theme.colors.onSurfaceVariant,
    tabIconDefault: theme.colors.onSurfaceVariant,
    tabIconSelected: theme.colors.primary,
    danger: p.danger,
    disabled: p.disabled,
    placeholder: p.placeholder,
    success: p.success,
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
