// components/ui/ios/LiquidButton.tsx
// Primary CTA button with Liquid Glass style on iOS 26+.
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SUPPORTS_LIQUID_GLASS } from '@/constants/Platform';
import { Typography } from '@/constants/Typography';

interface LiquidButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function LiquidButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  fullWidth = false,
}: LiquidButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      damping: 20,
      stiffness: 300,
    }).start();

  const handlePressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 300,
    }).start();

  const isDisabled = disabled || loading;

  if (variant === 'primary' && SUPPORTS_LIQUID_GLASS) {
    return (
      <Animated.View
        style={[
          s.container,
          fullWidth && { alignSelf: 'stretch' },
          { transform: [{ scale }] },
          isDisabled && { opacity: 0.6 },
          style,
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          style={s.pressable}
        >
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[Colors.accent + 'CC', Colors.accentDark + 'EE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={[Typography.button, s.label]}>{label}</Text>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  // Fallback / secondary / ghost
  const bgColor =
    variant === 'primary'
      ? Colors.accent
      : variant === 'secondary'
      ? Colors.surfaceAlt
      : Colors.transparent;

  const labelColor =
    variant === 'primary'
      ? Colors.white
      : variant === 'secondary'
      ? Colors.accent
      : Colors.accent;

  const borderColor =
    variant === 'ghost' ? Colors.accent : Colors.transparent;

  return (
    <Animated.View
      style={[
        s.container,
        fullWidth && { alignSelf: 'stretch' },
        { transform: [{ scale }] },
        isDisabled && { opacity: 0.6 },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          s.pressable,
          { backgroundColor: bgColor, borderWidth: variant === 'ghost' ? 1.5 : 0, borderColor },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <Text style={[Typography.button, { color: labelColor }]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  pressable: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.accent,
    minHeight: 52,
  },
  label: {
    color: Colors.white,
  },
});
