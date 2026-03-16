// components/ui/AppCard.tsx
// Cross-platform card: GlassCard on iOS 26+, M3Card on Android, plain card elsewhere.
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/Colors';
import { IS_ANDROID, IS_IOS } from '@/constants/Platform';
import { GlassCard } from './ios/GlassCard';
import { M3Card } from './android/M3Card';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  variant?: 'elevated' | 'filled' | 'outlined';
}

export function AppCard({ children, style, padding = 16, variant = 'elevated' }: AppCardProps) {
  if (IS_IOS) {
    return (
      <GlassCard style={style} padding={padding}>
        {children}
      </GlassCard>
    );
  }

  if (IS_ANDROID) {
    return (
      <M3Card style={style} padding={padding} variant={variant}>
        {children}
      </M3Card>
    );
  }

  // Web fallback
  return (
    <View style={[s.web, { padding }, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  web: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
