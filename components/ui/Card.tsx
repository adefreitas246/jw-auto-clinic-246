// components/ui/Card.tsx
import { GlassView } from 'expo-glass-effect';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { IS_IOS, SUPPORTS_LIQUID_GLASS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

type Variant = 'default' | 'elevated' | 'outlined' | 'glass';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
}

export function Card({
  children,
  variant = 'default',
  onPress,
  style,
  padding = 16,
}: CardProps) {
  const containerStyle = [
    s.base,
    { borderRadius: borderRadius.lg, padding },
    variant === 'default'   && s.default,
    variant === 'elevated'  && [s.elevated, cardShadow],
    variant === 'outlined'  && s.outlined,
    variant === 'glass'     && s.glass,
    style,
  ];

  if (variant === 'glass' && IS_IOS) {
    if (SUPPORTS_LIQUID_GLASS) {
      return (
        <View style={[s.base, { borderRadius: borderRadius.lg, overflow: 'hidden' }, style]}>
          <GlassView style={StyleSheet.absoluteFill} intensity={0.6} />
          <View style={{ padding }}>{children}</View>
        </View>
      );
    }
    return (
      <View style={[s.glassIOS, { borderRadius: borderRadius.lg, padding }, style]}>
        {children}
      </View>
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: Colors.accent + '12', borderless: false }}
        style={({ pressed }) => [
          containerStyle,
          pressed && IS_IOS && { opacity: 0.92 },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const s = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  default: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    backgroundColor: Colors.surface,
  },
  outlined: {
    backgroundColor: Colors.transparent,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  glass: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  glassIOS: {
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
