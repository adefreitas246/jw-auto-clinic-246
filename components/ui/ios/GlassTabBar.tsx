// components/ui/ios/GlassTabBar.tsx
// Frosted-glass bottom tab bar for iOS.
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { SUPPORTS_LIQUID_GLASS } from '@/constants/Platform';
import { Typography } from '@/constants/Typography';

export interface TabBarRoute {
  key: string;
  title: string;
  icon: (focused: boolean) => React.ReactNode;
}

interface GlassTabBarProps {
  routes: TabBarRoute[];
  activeIndex: number;
  onPress: (index: number) => void;
}

export function GlassTabBar({ routes, activeIndex, onPress }: GlassTabBarProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = insets.bottom + 4;

  const Inner = () => (
    <View style={[s.inner, { paddingBottom }]}>
      {routes.map((route, i) => {
        const focused = i === activeIndex;
        return (
          <TouchableOpacity
            key={route.key}
            style={s.tab}
            onPress={() => onPress(i)}
            activeOpacity={0.7}
          >
            {route.icon(focused)}
            <Text
              style={[
                Typography.caption,
                { color: focused ? Colors.accent : Colors.textMuted, marginTop: 2 },
              ]}
            >
              {route.title}
            </Text>
            {focused && <View style={s.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (!SUPPORTS_LIQUID_GLASS) {
    return (
      <View style={s.fallback}>
        <Inner />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.20)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.topBorder} />
      <Inner />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.6)',
  },
  fallback: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  inner: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  indicator: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
});
