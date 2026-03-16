// components/ui/Button.tsx
import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, fontWeight } from '@/utils/platformStyles';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const BG: Record<Variant, string> = {
  primary:   Colors.accent,
  secondary: Colors.surfaceAlt,
  ghost:     Colors.transparent,
  danger:    Colors.error,
};
const LABEL: Record<Variant, string> = {
  primary:   Colors.white,
  secondary: Colors.accent,
  ghost:     Colors.accent,
  danger:    Colors.white,
};
const BORDER: Record<Variant, string> = {
  primary:   Colors.transparent,
  secondary: Colors.transparent,
  ghost:     Colors.accent,
  danger:    Colors.transparent,
};
const PY: Record<Size, number> = { sm: 9, md: 13, lg: 16 };
const PX: Record<Size, number> = { sm: 14, md: 20, lg: 28 };
const FS: Record<Size, number> = { sm: 13, md: 15, lg: 17 };

export function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = false,
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      damping: 20,
      stiffness: 400,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 400,
    }).start();
  };

  const handlePress = () => {
    if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isDisabled = disabled || loading;

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && { alignSelf: 'stretch' as const },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        android_ripple={{ color: Colors.white + '30', borderless: false }}
        style={[
          s.base,
          {
            backgroundColor: BG[variant],
            paddingVertical: PY[size],
            paddingHorizontal: PX[size],
            borderRadius: borderRadius.md,
            borderWidth: variant === 'ghost' ? 1.5 : 0,
            borderColor: BORDER[variant],
            opacity: isDisabled ? 0.5 : 1,
          },
        ]}
      >
        {icon && !loading && icon}
        {loading ? (
          <ActivityIndicator size="small" color={LABEL[variant]} />
        ) : (
          <Text
            style={[
              s.label,
              { color: LABEL[variant], fontSize: FS[size] },
            ]}
          >
            {children}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  label: {
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
});
