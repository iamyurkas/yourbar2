export const palette = {
  primary: '#3A7BD5',
  primaryDark: '#244A80',
  accent: '#4FD1C5',
  background: '#FFFFFF',
  surface: '#F4F6FB',
  text: '#1A202C',
  muted: '#A0AEC0',
  warning: '#F6AD55',
  success: '#68D391',
  border: '#E2E8F0'
} as const;

export const statusDots = {
  missing: '#F56565',
  partial: '#F6AD55',
  ready: '#63B3ED'
} as const;

export type PaletteColor = keyof typeof palette;
