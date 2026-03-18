// app/(tabs)/settings.tsx — Staff Settings
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

function capitalizeRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

// ─── SettingsRow ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon, iconColor = Colors.accent, label, sublabel,
  onPress, right, destructive = false,
}: {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      android_ripple={{ color: Colors.border, borderless: false }}
    >
      <View style={[s.rowIcon, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, destructive && { color: Colors.error }]}>
          {label}
        </Text>
        {!!sublabel && <Text style={s.rowSublabel}>{sublabel}</Text>}
      </View>
      {right !== undefined ? right : (
        onPress && (
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        )
      )}
    </Pressable>
  );
}

// ─── EditProfileModal ─────────────────────────────────────────────────────────

function EditProfileModal({
  visible, name, phone, onClose, onSaved,
}: {
  visible: boolean;
  name: string;
  phone?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const parts    = name.split(' ');
  const [firstName, setFirstName] = useState(parts[0] ?? '');
  const [lastName,  setLastName]  = useState(parts.slice(1).join(' '));
  const [phoneVal,  setPhoneVal]  = useState(phone ?? '');
  const [saving,    setSaving]    = useState(false);

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'First name is required.');
      return;
    }
    setSaving(true);
    try {
      await axios.patch('/api/profile', {
        name:  `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phoneVal.trim() || undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.response?.data?.error ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.modalShell}>
          {/* Modal header */}
          <View style={s.modalHeader}>
            <Pressable onPress={onClose} hitSlop={10} style={{ minWidth: 64 }}>
              <Text style={s.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={s.modalTitle}>Edit Profile</Text>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              hitSlop={10}
              style={[{ minWidth: 64, alignItems: 'flex-end' }, saving && { opacity: 0.5 }]}
            >
              <Text style={s.modalSave}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.inputLabel}>First Name</Text>
            <TextInput
              style={s.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={s.inputLabel}>Last Name</Text>
            <TextInput
              style={s.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name (optional)"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={s.inputLabel}>Phone Number</Text>
            <TextInput
              style={s.input}
              value={phoneVal}
              onChangeText={setPhoneVal}
              placeholder="Optional"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              returnKeyType="done"
            />

            <Pressable
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={s.saveBtnText}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [editVisible,    setEditVisible]    = useState(false);
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [biometricOn,    setBiometricOn]    = useState(false);
  const [notifOn,        setNotifOn]        = useState(user?.notificationsEnabled ?? true);
  const [darkMode,       setDarkMode]       = useState(false);

  // ── Check biometric availability ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const hasHw    = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvail(hasHw && enrolled);
      const stored = await AsyncStorage.getItem('@biometric_enabled');
      setBiometricOn(stored === 'true');
    })();
  }, []);

  // ── Biometric toggle ──────────────────────────────────────────────────────
  const toggleBiometric = async (val: boolean) => {
    if (val) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable biometric login',
        cancelLabel:   'Cancel',
      });
      if (!res.success) return;
    }
    await AsyncStorage.setItem('@biometric_enabled', val ? 'true' : 'false');
    setBiometricOn(val);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Clear cache ───────────────────────────────────────────────────────────
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear locally stored data. You may need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Done', 'Cache cleared successfully.');
          },
        },
      ],
    );
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ],
    );
  };

  const displayName = user?.name ?? 'Staff Member';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          headerTintColor: Colors.accent,
        }}
      />

      <ScrollView
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={[s.scroll, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile Card ── */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(displayName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{displayName}</Text>
            <Text style={s.profileEmail} numberOfLines={1}>{user?.email ?? '—'}</Text>
            {!!user?.phone && (
              <Text style={s.profilePhone}>{user.phone}</Text>
            )}
          </View>
          <View style={s.roleBadge}>
            <Text style={s.roleBadgeText}>{capitalizeRole(user?.role ?? 'staff')}</Text>
          </View>
        </View>

        {/* Edit Profile ghost button */}
        <Pressable
          style={s.editProfileBtn}
          onPress={() => setEditVisible(true)}
        >
          <Ionicons name="pencil-outline" size={14} color={Colors.accent} />
          <Text style={s.editProfileText}>Edit Profile</Text>
        </Pressable>

        {/* ══════════════════════════════
            ACCOUNT
        ══════════════════════════════ */}
        <SectionHeader title="Account" />
        <View style={s.section}>
          <SettingsRow
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() =>
              Alert.alert(
                'Change Password',
                'A password reset link will be sent to your email.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Send Link', onPress: () => {} },
                ],
              )
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon="notifications-outline"
            label="Notification Preferences"
            right={
              <Switch
                value={notifOn}
                onValueChange={val => {
                  setNotifOn(val);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            }
          />
          {biometricAvail && (
            <>
              <View style={s.divider} />
              <SettingsRow
                icon="finger-print-outline"
                label="Biometric Login"
                sublabel="Use Face ID or fingerprint to sign in"
                right={
                  <Switch
                    value={biometricOn}
                    onValueChange={toggleBiometric}
                    trackColor={{ false: Colors.border, true: Colors.accent }}
                    thumbColor={Colors.white}
                  />
                }
              />
            </>
          )}
        </View>

        {/* ══════════════════════════════
            WORK
        ══════════════════════════════ */}
        <SectionHeader title="Work" />
        <View style={s.section}>
          <SettingsRow
            icon="calendar-outline"
            label="My Schedule"
            onPress={() => router.push('/(tabs)/schedule')}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="bar-chart-outline"
            label="My Performance"
            onPress={() => router.push('/(tabs)/performance')}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="construct-outline"
            label="Vehicle / Equipment Notes"
            onPress={() =>
              Alert.alert(
                'Equipment Notes',
                'Report any vehicle or equipment issues to your manager.',
                [{ text: 'OK' }],
              )
            }
          />
        </View>

        {/* ══════════════════════════════
            APP
        ══════════════════════════════ */}
        <SectionHeader title="App" />
        <View style={s.section}>
          <SettingsRow
            icon="language-outline"
            label="Language"
            right={<Text style={s.rowValue}>English</Text>}
            onPress={() =>
              Alert.alert('Language', 'Language selection coming soon.')
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon="moon-outline"
            label="Dark Mode"
            sublabel="Requires app restart to apply"
            right={
              <Switch
                value={darkMode}
                onValueChange={val => {
                  setDarkMode(val);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon="trash-outline"
            label="Clear Cache"
            onPress={handleClearCache}
          />
        </View>

        {/* ══════════════════════════════
            SUPPORT
        ══════════════════════════════ */}
        <SectionHeader title="Support" />
        <View style={s.section}>
          <SettingsRow
            icon="help-circle-outline"
            label="Help Center"
            onPress={() =>
              Alert.alert(
                'Help Center',
                'Contact your manager or visit the Wash Hub support portal.',
                [{ text: 'OK' }],
              )
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon="chatbubble-outline"
            label="Contact Manager"
            onPress={() =>
              Alert.alert(
                'Contact Manager',
                'Your message will be sent to your manager.',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: () => {} }],
              )
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon="flag-outline"
            label="Report an Issue"
            onPress={() =>
              Alert.alert(
                'Report an Issue',
                'Describe the issue and it will be sent to your manager.',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => {} }],
              )
            }
          />
        </View>

        {/* ══════════════════════════════
            DANGER ZONE
        ══════════════════════════════ */}
        <SectionHeader title="Danger Zone" />
        <View style={s.section}>
          <SettingsRow
            icon="log-out-outline"
            iconColor={Colors.error}
            label="Sign Out"
            destructive
            onPress={handleSignOut}
          />
        </View>

      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      {user && (
        <EditProfileModal
          visible={editVisible}
          name={user.name}
          phone={user.phone}
          onClose={() => setEditVisible(false)}
          onSaved={() => {
            // Data will re-hydrate on next app session via AuthContext
          }}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingTop: 20 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: borderRadius.xl,
    padding: 20,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText:   { fontSize: 22, fontWeight: '800', color: Colors.white },
  profileName:  { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  profileEmail: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  profilePhone: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  // Edit profile button
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end',
    marginRight: SCREEN_PADDING, marginTop: 10, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1.5, borderColor: Colors.accent,
  },
  editProfileText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // Section
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: SCREEN_PADDING, marginTop: 28, marginBottom: 8,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    marginHorizontal: SCREEN_PADDING,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: SCREEN_PADDING + 36 + 14, // past icon
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 14,
    gap: 14, minHeight: 56,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel:    { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowSublabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rowValue:    { fontSize: 14, color: Colors.textMuted },

  // Modal
  modalShell:   { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  modalTitle:  { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  modalCancel: { fontSize: 16, color: Colors.textMuted },
  modalSave:   { fontSize: 16, fontWeight: '700', color: Colors.accent },
  modalContent:{ padding: SCREEN_PADDING, paddingBottom: 40 },

  inputLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    marginTop: 20, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 16, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 32,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
