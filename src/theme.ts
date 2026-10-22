import { Platform, type TextStyle } from 'react-native';

// Single source of truth for the design system. Components import from here —
// never hardcode colors, spacing, or font sizes.

export const colors = {
  background: '#FFFFFF',
  surface: '#F5F8FF',
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1E3A8A',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  card: 12,
  pill: 999,
} as const;

// System font everywhere; Inter is preferred on web when installed.
const fontFamily = Platform.select({
  web: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

// Three sizes max per screen: title, body, caption.
export const typography = {
  title: { fontFamily, fontSize: 28, fontWeight: '700', lineHeight: 34 },
  body: { fontFamily, fontSize: 16, fontWeight: '400', lineHeight: 22 },
  caption: { fontFamily, fontSize: 13, fontWeight: '500', lineHeight: 18 },
} satisfies Record<string, TextStyle>;

export const layout = {
  maxContentWidth: 640,
  tabIconSize: 24,
  tabBarHeight: 60,
  ringSize: 160,
  ringStroke: 12,
  buttonHeight: 44,
  iconButtonSize: 32,
  chartHeight: 160,
  chartMarker: 8,
  chartLine: 2,
  chartAxisWidth: 72,
  barHeight: 8,
} as const;

export const theme = { colors, spacing, radius, typography, layout };
export type Theme = typeof theme;
