// app/(customer)/settings.tsx — Customer settings (tab screen)
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

type RowDef = {
  icon:    React.ComponentProps<typeof Ionicons>['name'];
  label:   string;
  onPress: () => void;
  danger?: boolean;
};

type SectionDef = {
  title: string;
  rows:  RowDef[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return (
    name.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CustomerSettingsScreen() {
  const { user, logout, updateProfile } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [saving,       setSaving]       = useState(false);

  // ── Edit profile modal ─────────────────────────────────────────────────────

  function openEditModal() {
    const parts = (user?.name ?? '').trim().split(/\s+/);
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' '));
    setPhone(user?.phone ?? '');
    setModalVisible(true);
  }

  function closeEditModal() {
    if (saving) return;
    setModalVisible(false);
  }

  async function handleSave() {
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    if (!name) return;
    try {
      setSaving(true);
      await updateProfile({ name, phone: phone.trim() || undefined });
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.error ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Sign out ───────────────────────────────────────────────────────────────

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  const sections: SectionDef[] = [
    {
      title: 'Account',
      rows: [
        { icon: 'lock-closed-outline',    label: 'Change Password',           onPress: () => {} },
        { icon: 'notifications-outline',  label: 'Notification Preferences',  onPress: () => {} },
        { icon: 'card-outline',           label: 'Payment Methods',           onPress: () => {} },
      ],
    },
    {
      title: 'My Stuff',
      rows: [
        { icon: 'car-outline',      label: 'My Vehicles',       onPress: () => router.push('/(customer)/vehicles')     },
        { icon: 'calendar-outline', label: 'My Bookings',       onPress: () => router.push('/(customer)/booking')      },
        { icon: 'star-outline',     label: 'My Rewards',        onPress: () => router.push('/(customer)/loyalty')      },
        { icon: 'refresh-outline',  label: 'Subscription Plan', onPress: () => router.push('/(customer)/subscriptions') },
        { icon: 'people-outline',   label: 'Refer a Friend',    onPress: () => router.push('/(customer)/referral')     },
      ],
    },
    {
      title: 'Support',
      rows: [
        { icon: 'help-circle-outline',   label: 'Help Center',       onPress: () => {} },
        { icon: 'chatbubble-outline',    label: 'Contact Support',   onPress: () => {} },
        { icon: 'document-text-outline', label: 'Privacy Policy',    onPress: () => {} },
        { icon: 'document-text-outline', label: 'Terms of Service',  onPress: () => {} },
      ],
    },
    {
      title: 'Danger Zone',
      rows: [
        { icon: 'log-out-outline', label: 'Sign Out',       onPress: handleSignOut,  danger: true },
        { icon: 'trash-outline',   label: 'Delete Account', onPress: () => {},        danger: true },
      ],
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="Settings" />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile card ── */}
        <Animated.View entering={FadeIn.duration(300)} style={s.profileCard}>
          {/* Avatar */}
          <View style={s.avatar}>
            <Text style={s.avatarText}>{getInitials(user?.name ?? '')}</Text>
          </View>

          {/* Name + email + badge */}
          <Text style={s.profileName}>{user?.name ?? 'Customer'}</Text>
          <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleBadgeText}>Customer</Text>
          </View>

          {/* Edit button */}
          <Pressable
            style={s.editBtn}
            onPress={openEditModal}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Ionicons name="pencil-outline" size={14} color={Colors.accent} />
            <Text style={s.editBtnText}>Edit Profile</Text>
          </Pressable>
        </Animated.View>

        {/* ── Setting sections ── */}
        {sections.map((section, si) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(60 + si * 60).duration(280)}
          >
            <Text style={s.sectionLabel}>{section.title}</Text>
            <View style={s.card}>
              {section.rows.map((row, ri) => (
                <React.Fragment key={row.label}>
                  {ri > 0 && <View style={s.divider} />}
                  <Pressable
                    style={({ pressed }) => [s.row, pressed && { opacity: 0.72 }]}
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
                    <Text style={[s.rowLabel, row.danger && s.rowLabelDanger]}>
                      {row.label}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          </Animated.View>
        ))}

      </ScrollView>

      {/* ── Edit Profile modal (bottom sheet) ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
          <Pressable style={s.backdrop} onPress={closeEditModal} />

          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Edit Profile</Text>

            <Text style={s.inputLabel}>First Name</Text>
            <TextInput
              style={s.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              textContentType="givenName"
            />

            <Text style={s.inputLabel}>Last Name</Text>
            <TextInput
              style={s.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              textContentType="familyName"
            />

            <Text style={s.inputLabel}>Phone Number</Text>
            <TextInput
              style={[s.input, { marginBottom: 24 }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />

            <View style={s.sheetBtns}>
              <Pressable
                style={s.cancelBtn}
                onPress={closeEditModal}
                disabled={saving}
                android_ripple={{ color: Colors.border, borderless: false }}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                android_ripple={{ color: Colors.accentDark, borderless: false }}
              >
                {saving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={s.saveBtnText}>Save Changes</Text>
                }
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },

  // Profile card
  profileCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: SCREEN_PADDING,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    ...cardShadow,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText:   { fontSize: 22, fontWeight: '800', color: Colors.accent },
  profileName:  { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: 14, color: Colors.textMuted },
  roleBadge:    { backgroundColor: Colors.accentMuted, borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 4, marginTop: 2 },
  roleBadgeText:{ fontSize: 12, fontWeight: '700', color: Colors.accent },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    overflow: 'hidden',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: SCREEN_PADDING,
    marginBottom: 8,
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: borderRadius.lg,
    marginBottom: 20,
    overflow: 'hidden',
    ...cardShadow,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 64,
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
  rowLabel:       { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowLabelDanger: { color: Colors.error },

  // Edit modal (bottom sheet)
  backdrop:    { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SCREEN_PADDING,
    paddingBottom: IS_IOS ? 40 : 24,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },

  inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    marginBottom: 14,
  },

  sheetBtns:    { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, padding: 14,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  cancelBtnText: { fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1, padding: 14,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
  saveBtnText: { fontWeight: '700', color: Colors.white, fontSize: 15 },
});
