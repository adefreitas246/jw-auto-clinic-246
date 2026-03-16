// components/ui/android/M3Header.tsx
// Material You top app bar for Android.
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { M3Elevation, StaticM3Colors } from '@/constants/MaterialTheme';
import { Typography } from '@/constants/Typography';

interface M3HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
  large?: boolean;
}

export function M3Header({
  title,
  subtitle,
  leftAction,
  rightAction,
  style,
  large = false,
}: M3HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top }, style]}>
      <View style={s.row}>
        <View style={s.side}>{leftAction}</View>
        <View style={s.center}>
          <Text
            style={[large ? Typography.title2 : Typography.headline, { color: StaticM3Colors.onSurface }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[Typography.footnote, { color: StaticM3Colors.onSurfaceVariant }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[s.side, s.sideRight]}>{rightAction}</View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: StaticM3Colors.surface,
    elevation: M3Elevation.level0,
    borderBottomWidth: 1,
    borderBottomColor: StaticM3Colors.surfaceContainerHighest,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    minHeight: 56,
  },
  side: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
});
