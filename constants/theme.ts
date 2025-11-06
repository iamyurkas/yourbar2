import { Platform } from 'react-native';

import { AppTheme } from '@/constants/app-theme';

const tintColorLight = AppTheme.colors.primary;
const tintColorDark = '#9CCAFF';

export const Colors = {
  light: {
    text: AppTheme.colors.onSurface,
    background: AppTheme.colors.background,
    surface: AppTheme.colors.surface,
    surfaceVariant: AppTheme.colors.surfaceVariant,
    outline: AppTheme.colors.outline,
    outlineVariant: AppTheme.colors.outlineVariant,
    tint: tintColorLight,
    icon: AppTheme.colors.onSurfaceVariant,
    tabIconDefault: AppTheme.colors.onSurfaceVariant,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F4F7FA',
    background: '#0E141B',
    surface: '#151F28',
    surfaceVariant: '#1E2A35',
    outline: 'rgba(255,255,255,0.1)',
    outlineVariant: 'rgba(255,255,255,0.05)',
    tint: tintColorDark,
    icon: '#8A97A8',
    tabIconDefault: '#748297',
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
