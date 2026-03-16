// components/ui/AppButton.tsx
// Cross-platform button: LiquidButton on iOS, M3Button on Android.
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';

import { IS_ANDROID, IS_IOS } from '@/constants/Platform';
import { LiquidButton } from './ios/LiquidButton';
import { M3Button } from './android/M3Button';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function AppButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  fullWidth = false,
}: AppButtonProps) {
  if (IS_IOS) {
    return (
      <LiquidButton
        label={label}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
        variant={variant}
        style={style}
        fullWidth={fullWidth}
      />
    );
  }

  // Android + Web: map variant to M3 variant
  const m3Variant =
    variant === 'primary'
      ? 'filled'
      : variant === 'secondary'
      ? 'tonal'
      : 'outlined';

  return (
    <M3Button
      label={label}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      variant={m3Variant}
      style={style}
      fullWidth={fullWidth}
    />
  );
}
