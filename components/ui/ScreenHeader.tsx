// components/ui/ScreenHeader.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { SCREEN_PADDING } from '@/utils/platformStyles';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
  backButton?: boolean;
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  subtitle,
  rightAction,
  backButton = false,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[s.container, style]}>
      <View style={s.row}>
        {backButton && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={s.backBtn}
            android_ripple={{ color: Colors.accent + '20', borderless: true }}
          >
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </Pressable>
        )}
        <View style={s.titleBlock}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {rightAction && (
          <Pressable
            onPress={rightAction.onPress}
            hitSlop={8}
            style={s.rightBtn}
            android_ripple={{ color: Colors.accent + '20', borderless: true }}
          >
            {rightAction.icon ? (
              <Ionicons name={rightAction.icon} size={22} color={Colors.accent} />
            ) : (
              <Text style={s.rightLabel}>{rightAction.label}</Text>
            )}
          </Pressable>
        )}
      </View>
      <View style={s.divider} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    marginLeft: -4,
    marginRight: 4,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  rightLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 12,
    marginHorizontal: -SCREEN_PADDING,
  },
});
