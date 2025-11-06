import { MD3LightTheme as BaseTheme } from '@/libs/react-native-paper';

export const AppTheme = {
  ...BaseTheme,
  version: 3,
  colors: {
    ...BaseTheme.colors,

    primary: '#4DABF7',
    secondary: '#74C0FC',
    tertiary: '#A5D8FF',

    primaryContainer: '#D0EBFF',
    inversePrimary: '#E9F7DF',

    background: '#FFFFFF',
    surface: '#F8F9FA',
    outline: '#E5EAF0',
    outlineVariant: '#E9EEF4',
    surfaceVariant: '#EAF3F9',

    error: '#FF6B6B',
    errorContainer: '#FFE3E6',
    onError: '#FFFFFF',
    onErrorContainer: '#7A1C1C',

    onPrimary: '#FFFFFF',
    onBackground: '#000000',
    onSurface: '#303030',
    onSurfaceVariant: '#A1A1A1',

    disabled: '#CED4DA',
    placeholder: '#A1A1A1',
    backdrop: 'rgba(0,0,0,0.4)',
  },
} as const;

export const TAG_COLORS = [
  '#ec5a5a',
  '#F06292',
  '#BA68C8',
  '#9575CD',
  '#7986CB',
  '#64B5F6',
  '#4FC3F7',
  '#4DD0E1',
  '#4DB6AC',
  '#81C784',
  '#AED581',
  '#DCE775',
  '#FFD54F',
  '#FFB74D',
  '#FF8A65',
  '#a8a8a8',
] as const;
