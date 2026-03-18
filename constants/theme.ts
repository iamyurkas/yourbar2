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
    styledIngredient: theme.colors.styledIngredient ?? lightPalette.styledIngredient,
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
  styledIngredient: lightPalette.styledIngredient,
} as const;
