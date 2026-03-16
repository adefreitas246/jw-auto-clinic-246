// components/ui/ListItem.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';

interface ListItemProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  showSeparator?: boolean;
  destructive?: boolean;
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  style,
  showSeparator = true,
  destructive = false,
}: ListItemProps) {
  const inner = (
    <View style={[s.row, style]}>
      {left && <View style={s.left}>{left}</View>}
      <View style={s.body}>
        <Text
          style={[s.title, destructive && { color: Colors.error }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={s.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={s.right}>{right}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: Colors.accent + '10', borderless: false }}
        style={({ pressed }) => [
          s.item,
          pressed && IS_IOS && { backgroundColor: Colors.surfaceAlt },
        ]}
      >
        {inner}
        {showSeparator && IS_IOS && <View style={s.separator} />}
      </Pressable>
    );
  }

  return (
    <View style={s.item}>
      {inner}
      {showSeparator && IS_IOS && <View style={s.separator} />}
    </View>
  );
}

const s = StyleSheet.create({
  item: {
    backgroundColor: Colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 56,
  },
});
