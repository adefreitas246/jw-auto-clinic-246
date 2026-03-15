import { Colors } from '@/constants/Colors';

// Maps the legacy Expo template colorName keys to our flat Colors tokens.
const colorMap = {
  text:       Colors.textPrimary,
  background: Colors.background,
  tint:       Colors.accent,
  icon:       Colors.textMuted,
  tabIconDefault:  Colors.textMuted,
  tabIconSelected: Colors.accent,
} as const;

type ColorName = keyof typeof colorMap;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ColorName,
) {
  return props.light ?? colorMap[colorName];
}
