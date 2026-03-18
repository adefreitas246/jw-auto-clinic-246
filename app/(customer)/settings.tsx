// app/(customer)/settings.tsx — Customer profile & settings
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
import ReAnimated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader, Avatar } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

type EditableField = 'name' | 'email' | 'phone';

type SettingRow = {
  icon:     React.ComponentProps<typeof Ionicons>['name'];
  label:    string;
  value?:   string;
  onPress:  () => void;
  danger?:  boolean;
  editable?: boolean;
};

const FIELD_LABELS: Record<EditableField, string> = {
  name:  'Name',
  email: 'Email',
  phone: 'Phone',
};

const FIELD_INPUT_PROPS: Record<EditableField, object> = {
  name:  { autoCapitalize: 'words',  keyboardType: 'default',       textContentType: 'name' },
  email: { autoCapitalize: 'none',   keyboardType: 'email-address', textContentType: 'emailAddress' },
  phone: { autoCapitalize: 'none',   keyboardType: 'phone-pad',     textContentType: 'telephoneNumber' },
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CustomerSettingsScreen() {
  const { user, logout, updateProfile } = useAuth();

  const [editField,  setEditField]  = useState<EditableField | null>(null);
  const [editValue,  setEditValue]  = useState('');
  const [saving,     setSaving]     = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? 'Customer';

  // ── Edit modal ─────────────────────────────────────────────────────────────

  const openEdit = (field: EditableField, current: string) => {
    setEditField(field);
    setEditValue(current);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditField(null);
    setEditValue('');
  };

  const handleSave = async () => {
    if (!editField || !editValue.trim()) return;
    try {
      setSaving(true);
      await updateProfile({ [editField]: editValue.trim() });
      setEditField(null);
      setEditValue('');
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.error ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────

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

  // ── Rows ───────────────────────────────────────────────────────────────────

  const profileRows: SettingRow[] = [
    {
      icon:     'person-outline',
      label:    'Name',
      value:    user?.name ?? '—',
      editable: true,
      onPress:  () => openEdit('name', user?.name ?? ''),
    },
    {
      icon:     'mail-outline',
      label:    'Email',
      value:    user?.email ?? '—',
      editable: true,
      onPress:  () => openEdit('email', user?.email ?? ''),
    },
    {
      icon:     'call-outline',
      label:    'Phone',
      value:    user?.phone ?? 'Not set',
      editable: true,
      onPress:  () => openEdit('phone', user?.phone ?? ''),
    },
  ];

  const accountRows: SettingRow[] = [
    {
      icon:    'notifications-outline',
      label:   'Notifications',
      onPress: () => router.push('/(customer)/notifications'),
    },
    {
      icon:    'log-out-outline',
      label:   'Sign Out',
      onPress: handleLogout,
      danger:  true,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="Profile" backButton />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar hero ── */}
        <ReAnimated.View entering={FadeInDown.duration(300)} style={s.hero}>
          <Avatar name={firstName} size={80} />
          <Text style={s.name}>{user?.name ?? 'Customer'}</Text>
          <Text style={s.email}>{user?.email ?? ''}</Text>
        </ReAnimated.View>

        {/* ── Profile rows ── */}
        <ReAnimated.View entering={FadeInDown.delay(80).duration(300)}>
          <Text style={s.sectionLabel}>Profile</Text>
          <View style={s.card}>
            {profileRows.map((row, i) => (
              <React.Fragment key={row.label}>
                {i > 0 && <View style={s.divider} />}
                <Pressable
                  style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
                  onPress={row.onPress}
                  android_ripple={{ color: Colors.accent + '18', borderless: false }}
                >
                  <View style={s.iconWrap}>
                    <Ionicons name={row.icon} size={18} color={Colors.accent} />
                  </View>
                  <View style={s.rowText}>
                    <Text style={s.rowLabel}>{row.label}</Text>
                    {row.value ? (
                      <Text style={s.rowValue} numberOfLines={1}>{row.value}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </ReAnimated.View>

        {/* ── Account rows ── */}
        <ReAnimated.View entering={FadeInDown.delay(160).duration(300)}>
          <Text style={s.sectionLabel}>Account</Text>
          <View style={s.card}>
            {accountRows.map((row, i) => (
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
                  </View>
                  {!row.danger && (
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  )}
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </ReAnimated.View>
      </ScrollView>

      {/* ── Edit field modal ── */}
      <Modal
        visible={editField !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={IS_IOS ? 'padding' : undefined}
        >
          <Pressable style={s.backdrop} onPress={closeEdit} />

          <View style={s.sheet}>
            <View style={s.sheetHandle} />

            <Text style={s.sheetTitle}>
              Edit {editField ? FIELD_LABELS[editField] : ''}
            </Text>

            <TextInput
              style={s.input}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={editField ? FIELD_LABELS[editField] : ''}
              placeholderTextColor={Colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
              {...(editField ? FIELD_INPUT_PROPS[editField] : {})}
            />

            <View style={s.sheetBtns}>
              <Pressable
                style={s.cancelBtn}
                onPress={closeEdit}
                disabled={saving}
                android_ripple={{ color: Colors.border, borderless: false }}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[s.saveBtn, (!editValue.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!editValue.trim() || saving}
                android_ripple={{ color: Colors.accentDark, borderless: false }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
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
  content: { paddingBottom: SCROLL_PADDING_BOTTOM },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  name:  { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  email: { fontSize: 14, color: Colors.textSecondary },

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

  // Edit modal
  backdrop:    { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: borderRadius.xl ?? borderRadius.lg,
    borderTopRightRadius: borderRadius.xl ?? borderRadius.lg,
    padding: 24,
    paddingBottom: IS_IOS ? 40 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.borderFocus,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  sheetBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: { fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveBtnText: { fontWeight: '700', color: Colors.white, fontSize: 15 },
});
