// components/ui/android/M3TabBar.tsx
// Material You navigation bar for Android.
import React from 'react';
import { StyleSheet, Text, TouchableNativeFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { M3Shape, StaticM3Colors } from '@/constants/MaterialTheme';
import { Typography } from '@/constants/Typography';

export interface M3TabRoute {
  key: string;
  title: string;
  icon: (focused: boolean) => React.ReactNode;
}

interface M3TabBarProps {
  routes: M3TabRoute[];
  activeIndex: number;
  onPress: (index: number) => void;
}

export function M3TabBar({ routes, activeIndex, onPress }: M3TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingBottom: insets.bottom }]}>
      {routes.map((route, i) => {
        const focused = i === activeIndex;
        return (
          <View key={route.key} style={s.tabWrapper}>
            <TouchableNativeFeedback
              onPress={() => onPress(i)}
              background={TouchableNativeFeedback.Ripple(
                StaticM3Colors.primary + '22',
                false
              )}
            >
              <View style={s.tab}>
                <View
                  style={[
                    s.indicator,
                    focused && s.indicatorActive,
                  ]}
                >
                  {route.icon(focused)}
                </View>
                <Text
                  style={[
                    Typography.caption,
                    {
                      color: focused
                        ? StaticM3Colors.onSurface
                        : StaticM3Colors.onSurfaceVariant,
                      fontWeight: focused ? '600' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {route.title}
                </Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: StaticM3Colors.surface,
    borderTopWidth: 1,
    borderTopColor: StaticM3Colors.surfaceContainerHighest,
    paddingTop: 12,
  },
  tabWrapper: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: M3Shape.large,
  },
  tab: {
    alignItems: 'center',
    paddingBottom: 8,
    gap: 4,
  },
  indicator: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorActive: {
    backgroundColor: StaticM3Colors.secondaryContainer,
  },
});
