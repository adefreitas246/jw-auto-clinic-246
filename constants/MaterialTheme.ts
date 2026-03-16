// constants/MaterialTheme.ts
// Material You seed color and static fallback palette for Android.
import { Colors } from './Colors';

/** Seed color for @pchmn/expo-material3-theme dynamic color generation */
export const MATERIAL_SEED_COLOR = Colors.accent; // sky blue #0EA5E9

/** Static M3 color tokens used when dynamic color is unavailable */
export const StaticM3Colors = {
  primary:           Colors.accent,
  onPrimary:         Colors.white,
  primaryContainer:  Colors.accentMuted,
  onPrimaryContainer: Colors.accentDark,

  secondary:         Colors.primaryLight,
  onSecondary:       Colors.white,
  secondaryContainer: Colors.surfaceAlt,
  onSecondaryContainer: Colors.textPrimary,

  surface:           Colors.surface,
  onSurface:         Colors.textPrimary,
  surfaceVariant:    Colors.surfaceAlt,
  onSurfaceVariant:  Colors.textSecondary,
  surfaceContainerHighest: Colors.border,

  background:        Colors.background,
  onBackground:      Colors.textPrimary,

  outline:           Colors.border,
  outlineVariant:    Colors.borderStrong,

  error:             Colors.error,
  onError:           Colors.white,
  errorContainer:    Colors.errorBg,
  onErrorContainer:  Colors.errorText,

  inverseSurface:    Colors.primary,
  inverseOnSurface:  Colors.textInverse,
  inversePrimary:    Colors.accentLight,
} as const;

/** M3 elevation levels (dp) */
export const M3Elevation = {
  level0: 0,
  level1: 1,
  level2: 3,
  level3: 6,
  level4: 8,
  level5: 12,
} as const;

/** M3 shape radii */
export const M3Shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 999,
} as const;

export default {
  MATERIAL_SEED_COLOR,
  StaticM3Colors,
  M3Elevation,
  M3Shape,
};
