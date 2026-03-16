// components/ui/android/M3Card.tsx
// Material You elevated card for Android.
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/Colors';
import { M3Elevation, M3Shape, StaticM3Colors } from '@/constants/MaterialTheme';

interface M3CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'elevated' | 'filled' | 'outlined';
  padding?: number;
}

export function M3Card({
  children,
  style,
  variant = 'elevated',
  padding = 16,
}: M3CardProps) {
  return (
    <View
      style={[
        s.base,
        variant === 'elevated' && s.elevated,
        variant === 'filled' && s.filled,
        variant === 'outlined' && s.outlined,
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: M3Shape.medium,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: StaticM3Colors.surface,
    elevation: M3Elevation.level1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  filled: {
    backgroundColor: StaticM3Colors.surfaceVariant,
    elevation: 0,
  },
  outlined: {
    backgroundColor: StaticM3Colors.surface,
    borderWidth: 1,
    borderColor: StaticM3Colors.outline,
    elevation: 0,
  },
});
