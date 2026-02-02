import { Appearance, Platform } from 'react-native';

import { getAppTheme, getPalette, type ThemeScheme } from '@/theme/theme';

type ThemeColors = ReturnType<typeof getAppTheme>['colors'];
type ThemePalette = ReturnType<typeof getPalette>;
type AppColors = ThemeColors & {
  text: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  danger: string;
  disabled: string;
  placeholder: string;
  success: string;
};

const buildColors = (scheme: ThemeScheme): AppColors => {
  const themeColors = getAppTheme(scheme).colors;
  const activePalette = getPalette(scheme);
  const tintColor = themeColors.primary;

  return {
    ...themeColors,
    text: themeColors.onSurface,
    tint: tintColor,
    icon: themeColors.onSurfaceVariant,
    tabIconDefault: themeColors.onSurfaceVariant,
    tabIconSelected: tintColor,
    danger: activePalette.danger,
    disabled: activePalette.disabled,
    placeholder: activePalette.placeholder,
    success: activePalette.success,
  };
};

const initialScheme: ThemeScheme =
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export const Colors = buildColors(initialScheme);

export const setThemeScheme = (scheme: ThemeScheme) => {
  Object.assign(Colors, buildColors(scheme));
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
