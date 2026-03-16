// components/ui/android/M3Button.tsx
// Material You button for Android.
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableNativeFeedback,
  View,
  ViewStyle,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { M3Shape, StaticM3Colors } from '@/constants/MaterialTheme';
import { Typography } from '@/constants/Typography';

interface M3ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function M3Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'filled',
  style,
  fullWidth = false,
}: M3ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    s.base,
    variant === 'filled' && s.filled,
    variant === 'tonal' && s.tonal,
    variant === 'outlined' && s.outlined,
    variant === 'text' && s.text,
    fullWidth && { alignSelf: 'stretch' as const },
    isDisabled && s.disabled,
    style,
  ];

  const labelColor =
    variant === 'filled'
      ? StaticM3Colors.onPrimary
      : variant === 'tonal'
      ? StaticM3Colors.onPrimaryContainer
      : variant === 'outlined'
      ? StaticM3Colors.primary
      : StaticM3Colors.primary;

  return (
    <View style={[containerStyle, { overflow: 'hidden', borderRadius: M3Shape.full }]}>
      <TouchableNativeFeedback
        onPress={onPress}
        disabled={isDisabled}
        background={TouchableNativeFeedback.Ripple(Colors.white + '40', false)}
      >
        <View style={s.inner}>
          {loading ? (
            <ActivityIndicator color={labelColor} size="small" />
          ) : (
            <Text style={[Typography.button, { color: labelColor }]}>{label}</Text>
          )}
        </View>
      </TouchableNativeFeedback>
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: M3Shape.full,
    overflow: 'hidden',
  },
  filled: {
    backgroundColor: StaticM3Colors.primary,
    elevation: 2,
  },
  tonal: {
    backgroundColor: StaticM3Colors.primaryContainer,
    elevation: 0,
  },
  outlined: {
    backgroundColor: Colors.transparent,
    borderWidth: 1,
    borderColor: StaticM3Colors.outline,
    elevation: 0,
  },
  text: {
    backgroundColor: Colors.transparent,
    elevation: 0,
  },
  disabled: {
    opacity: 0.38,
  },
  inner: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    flexDirection: 'row',
    gap: 8,
  },
});
