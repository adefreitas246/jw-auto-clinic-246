// components/ui/ios/GlassCard.tsx
// Liquid Glass card for iOS 26+. Falls back to a plain white card on older iOS.
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/Colors';
import { SUPPORTS_LIQUID_GLASS } from '@/constants/Platform';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  padding?: number;
}

export function GlassCard({
  children,
  style,
  intensity = 60,
  tint = 'light',
  padding = 16,
}: GlassCardProps) {
  if (!SUPPORTS_LIQUID_GLASS) {
    return (
      <View style={[s.fallback, { padding }, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[s.container, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Top highlight edge */}
      <View style={s.topHighlight} />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  fallback: {
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
});
