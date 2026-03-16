// components/ui/Avatar.tsx
import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';

interface AvatarProps {
  name?: string;
  uri?: string | null;
  size?: number;
  style?: ViewStyle;
}

function colorFromName(name: string): string {
  const palette = [
    Colors.accent, Colors.accentDark, Colors.primary, Colors.success,
    Colors.warning, Colors.info, Colors.accentLight,
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name = '', uri, size = 40, style }: AvatarProps) {
  const bg = colorFromName(name);
  const fontSize = size * 0.38;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          s.base,
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        s.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[s.initials, { fontSize, color: Colors.white }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
