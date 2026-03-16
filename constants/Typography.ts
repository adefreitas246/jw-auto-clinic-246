// constants/Typography.ts
import { Platform, TextStyle } from 'react-native';
import { Colors } from './Colors';

const IOS_FONT = 'System';
const ANDROID_FONT = 'Roboto';
const BASE_FONT = Platform.OS === 'ios' ? IOS_FONT : ANDROID_FONT;

export const FontFamily = {
  regular: BASE_FONT,
  medium: BASE_FONT,
  semiBold: BASE_FONT,
  bold: BASE_FONT,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const Typography = {
  largeTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
    letterSpacing: 0.37,
  },
  title1: {
    fontSize: FontSize['2xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
  },
  title2: {
    fontSize: FontSize.xl,
    fontWeight: '700' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
  },
  title3: {
    fontSize: FontSize.lg,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
  },
  headline: {
    fontSize: FontSize.md,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
  },
  body: {
    fontSize: FontSize.base,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
  },
  bodyMedium: {
    fontSize: FontSize.base,
    fontWeight: '500' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
  },
  callout: {
    fontSize: FontSize.base,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.textSecondary,
  },
  subhead: {
    fontSize: FontSize.sm,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.textSecondary,
  },
  footnote: {
    fontSize: FontSize.xs + 1,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.textMuted,
  },
  caption: {
    fontSize: FontSize.xs,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.textMuted,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  button: {
    fontSize: FontSize.md,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.white,
    letterSpacing: 0.3,
  },
  buttonSm: {
    fontSize: FontSize.sm,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.white,
  },
} as const;

export default Typography;
