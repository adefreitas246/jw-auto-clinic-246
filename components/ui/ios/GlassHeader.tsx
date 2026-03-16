// components/ui/ios/GlassHeader.tsx
// Frosted-glass navigation header for iOS.
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { SUPPORTS_LIQUID_GLASS } from '@/constants/Platform';
import { Typography } from '@/constants/Typography';

interface GlassHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
  large?: boolean;
}

export function GlassHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  style,
  large = false,
}: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + 8;

  if (!SUPPORTS_LIQUID_GLASS) {
    return (
      <View style={[s.fallback, { paddingTop }, style]}>
        <View style={s.row}>
          <View style={s.side}>{leftAction}</View>
          <View style={s.center}>
            <Text style={large ? Typography.title2 : Typography.headline} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={Typography.footnote} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
          <View style={[s.side, s.sideRight]}>{rightAction}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop }, style]}>
      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.20)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.bottomBorder} />
      <View style={s.row}>
        <View style={s.side}>{leftAction}</View>
        <View style={s.center}>
          <Text
            style={large ? Typography.title2 : Typography.headline}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={Typography.footnote} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={[s.side, s.sideRight]}>{rightAction}</View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.4)',
  },
  bottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 44,
  },
  side: {
    width: 60,
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  fallback: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
