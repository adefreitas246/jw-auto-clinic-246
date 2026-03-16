// components/ui/StatCard.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { cardShadow } from '@/utils/platformStyles';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  icon,
  color = Colors.accent,
  trend,
  style,
}: StatCardProps) {
  // Count-up animation for numeric values
  const animValue = useRef(new Animated.Value(0)).current;
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  const isNumeric = !isNaN(numericValue);

  useEffect(() => {
    if (isNumeric) {
      Animated.timing(animValue, {
        toValue: numericValue,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [numericValue]);

  return (
    <View style={[s.card, cardShadow, style]}>
      <View style={[s.iconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={s.value} numberOfLines={1}>
        {typeof value === 'string' ? value : value}
      </Text>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
      {trend && (
        <View style={s.trend}>
          <Ionicons
            name={trend.direction === 'up' ? 'trending-up' : 'trending-down'}
            size={13}
            color={trend.direction === 'up' ? Colors.success : Colors.error}
          />
          <Text style={[s.trendText, { color: trend.direction === 'up' ? Colors.success : Colors.error }]}>
            {trend.value}%
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
