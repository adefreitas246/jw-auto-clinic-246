// utils/platformStyles.ts
import { Colors } from '@/constants/Colors';
import { IS_IOS, SUPPORTS_LIQUID_GLASS } from './platform';

// Platform-specific shadow styles
export const cardShadow = IS_IOS
  ? {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    }
  : { elevation: 3 };

export const headerShadow = IS_IOS
  ? {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }
  : { elevation: 4 };

export const modalShadow = IS_IOS
  ? {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    }
  : { elevation: 16 };

// Liquid Glass style (iOS 26+ / fallback for older iOS)
export const glassStyle = SUPPORTS_LIQUID_GLASS
  ? {}
  : {
      backgroundColor: 'rgba(255,255,255,0.85)',
    };

// Platform-specific border radius
export const borderRadius = {
  sm:   IS_IOS ? 10  : 8,
  md:   IS_IOS ? 14  : 12,
  lg:   IS_IOS ? 20  : 16,
  xl:   IS_IOS ? 28  : 24,
  full: 999,
} as const;

// Platform-specific font weights
export const fontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
  heavy:    IS_IOS ? '800' as const : '700' as const,
} as const;

// Consistent spacing grid (multiples of 4)
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  base: 16,
  lg:  20,
  xl:  24,
  '2xl': 32,
  '3xl': 48,
} as const;

// Screen horizontal padding
export const SCREEN_PADDING = 20;
export const SCREEN_PADDING_BOTTOM = 100;

// Android Material You elevation
export const androidElevation = {
  surface: 0,
  level1:  1,
  level2:  3,
  level3:  6,
  level4:  8,
  level5:  12,
} as const;
