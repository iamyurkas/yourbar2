import { Platform } from 'react-native';

import { getAppTheme, getPalette, lightTheme, type AppColorScheme } from '@/theme/theme';
import type { PaperTheme } from '@/libs/react-native-paper';

const buildColors = (
  theme: PaperTheme,
  paletteColors: ReturnType<typeof getPalette>,
) => {
  const tintColor = theme.colors.primary;

  return {
    ...theme.colors,
    text: theme.colors.onSurface,
    tint: tintColor,
    icon: theme.colors.onSurfaceVariant,
    tabIconDefault: theme.colors.onSurfaceVariant,
    tabIconSelected: tintColor,
    danger: paletteColors.danger,
    disabled: paletteColors.disabled,
    placeholder: paletteColors.placeholder,
    success: paletteColors.success,
  } as const;
};

export const Colors = {
  ...buildColors(lightTheme, getPalette('light')),
};

export const setColorsForScheme = (scheme: AppColorScheme) => {
  const theme = getAppTheme(scheme);
  const paletteColors = getPalette(scheme);
  Object.assign(Colors, buildColors(theme, paletteColors));
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
