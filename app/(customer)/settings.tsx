// app/(customer)/settings.tsx — Customer profile & settings
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

type SettingRow = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
};

export default function CustomerSettingsScreen() {
  const { user, logout } = useAuth();

  const firstName = user?.name?.split(' ')[0] ?? 'Customer';

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const rows: SettingRow[] = [
    {
      icon: 'person-outline',
      label: 'Name',
      value: user?.name ?? '—',
      onPress: () => {},
    },
    {
      icon: 'mail-outline',
      label: 'Email',
      value: user?.email ?? '—',
      onPress: () => {},
    },
    {
      icon: 'call-outline',
      label: 'Phone',
      value: user?.phone ?? 'Not set',
      onPress: () => {},
    },
    {
      icon: 'log-out-outline',
      label: 'Sign Out',
      onPress: handleLogout,
      danger: true,
    },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="Profile" backButton />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar hero */}
        <ReAnimated.View entering={FadeInDown.duration(300)} style={s.hero}>
          <Avatar name={firstName} size={80} />
          <Text style={s.name}>{user?.name ?? 'Customer'}</Text>
          <Text style={s.email}>{user?.email ?? ''}</Text>
        </ReAnimated.View>

        {/* Settings rows */}
        <ReAnimated.View entering={FadeInDown.delay(80).duration(300)} style={s.card}>
          {rows.map((row, i) => (
            <React.Fragment key={row.label}>
              {i > 0 && <View style={s.divider} />}
              <Pressable
                style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
                onPress={row.onPress}
                android_ripple={{ color: Colors.accent + '18', borderless: false }}
              >
                <View style={[s.iconWrap, row.danger && s.iconWrapDanger]}>
                  <Ionicons
                    name={row.icon}
                    size={18}
                    color={row.danger ? Colors.error : Colors.accent}
                  />
                </View>
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, row.danger && s.rowLabelDanger]}>
                    {row.label}
                  </Text>
                  {row.value ? (
                    <Text style={s.rowValue} numberOfLines={1}>
                      {row.value}
                    </Text>
                  ) : null}
                </View>
                {!row.danger && (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                )}
              </Pressable>
            </React.Fragment>
          ))}
        </ReAnimated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },

  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  name:  { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  email: { fontSize: 14, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: borderRadius.lg,
    ...cardShadow,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 60,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: { backgroundColor: Colors.errorBg },
  rowText:        { flex: 1 },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rowLabelDanger: { color: Colors.error },
  rowValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
