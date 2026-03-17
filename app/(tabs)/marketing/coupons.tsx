// app/(tabs)/marketing/coupons.tsx
// Admin coupon code management — create, toggle active, view usage stats.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type CouponType = 'percent' | 'fixed';

type Coupon = {
  _id:           string;
  code:          string;
  type:          CouponType;
  value:         number;
  minOrderValue: number;
  expiresAt:     string | null;
  maxUses:       number | null;
  usedCount:     number;
  active:        boolean;
  createdAt:     string;
};

type FormState = {
  code:          string;
  type:          CouponType;
  value:         string;
  minOrderValue: string;
  expiresAt:     string;
  maxUses:       string;
};

const BLANK: FormState = { code: '', type: 'percent', value: '', minOrderValue: '', expiresAt: '', maxUses: '' };

export default function CouponsScreen() {
  const { token } = useAuth();
  const router    = useRouter();

  const [coupons,    setCoupons]    = useState<Coupon[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal,      setModal]      = useState(false);
  const [editing,    setEditing]    = useState<Coupon | null>(null);
  const [form,       setForm]       = useState<FormState>(BLANK);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState<Partial<FormState>>({});

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get<Coupon[]>('/api/marketing/coupons', { headers });
      setCoupons(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setErrors({});
    setModal(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code:          c.code,
      type:          c.type,
      value:         String(c.value),
      minOrderValue: c.minOrderValue ? String(c.minOrderValue) : '',
      expiresAt:     c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      maxUses:       c.maxUses != null ? String(c.maxUses) : '',
    });
    setErrors({});
    setModal(true);
  }

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!form.code.trim())                          e.code  = 'Code is required.';
    if (!form.value || isNaN(Number(form.value)) || Number(form.value) <= 0)
      e.value = 'Enter a positive value.';
    if (form.type === 'percent' && Number(form.value) > 100)
      e.value = 'Percentage cannot exceed 100.';
    if (form.expiresAt && isNaN(new Date(form.expiresAt).getTime()))
      e.expiresAt = 'Invalid date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        code:          form.code.trim().toUpperCase(),
        type:          form.type,
        value:         Number(form.value),
        minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : 0,
        expiresAt:     form.expiresAt || null,
        maxUses:       form.maxUses   ? Number(form.maxUses) : null,
      };
      if (editing) {
        await axios.patch(
          `/api/marketing/coupons/${editing._id}`,
          { value: payload.value, minOrderValue: payload.minOrderValue, expiresAt: payload.expiresAt, maxUses: payload.maxUses },
          { headers }
        );
      } else {
        await axios.post('/api/marketing/coupons', payload, { headers });
      }
      setModal(false);
      load();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrors({ code: 'A coupon with this code already exists.' });
      } else {
        Alert.alert('Error', err.response?.data?.error ?? 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(c: Coupon) {
    try {
      await axios.patch(`/api/marketing/coupons/${c._id}`, { active: !c.active }, { headers });
      load();
    } catch {}
  }

  async function handleDelete(c: Coupon) {
    Alert.alert('Deactivate', `Deactivate "${c.code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`/api/marketing/coupons/${c._id}`, { headers });
            load();
          } catch {}
        },
      },
    ]);
  }

  const isExpired = (c: Coupon) => !!c.expiresAt && new Date(c.expiresAt) < new Date();
  const isFull    = (c: Coupon) => c.maxUses != null && c.usedCount >= c.maxUses;

  return (
    <SafeAreaView style={cp.safe}>
      <ScreenHeader
        title="Coupon Codes"
        backButton
        rightAction={
          <Pressable
            onPress={openCreate}
            style={cp.addBtn}
            android_ripple={{ color: Colors.accentDark, radius: 20, borderless: true }}
          >
            <Ionicons name="add" size={20} color={Colors.white} />
          </Pressable>
        }
      />

      <FlatList
        data={coupons}
        keyExtractor={c => c._id}
        contentContainerStyle={cp.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={cp.emptyWrap}>
            <View style={cp.emptyIcon}>
              <Ionicons name="pricetag-outline" size={36} color={Colors.textMuted} />
            </View>
            <Text style={cp.emptyTitle}>No coupons yet</Text>
            <Text style={cp.empty}>Tap + to create your first discount code.</Text>
          </View>
        }
        renderItem={({ item: c, index }) => {
          const expired  = isExpired(c);
          const full     = isFull(c);
          const usagePct = c.maxUses ? Math.min(1, c.usedCount / c.maxUses) : null;

          return (
            <ReAnimated.View entering={FadeInDown.delay(index * 60).duration(300)}>
            <View style={[cp.card, !c.active && { opacity: 0.55 }]}>
              <View style={cp.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={cp.codeRow}>
                    <Text style={cp.code}>{c.code}</Text>
                    {(expired || full) && (
                      <View style={cp.expiredBadge}>
                        <Text style={cp.expiredText}>{full ? 'Exhausted' : 'Expired'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={cp.valueLine}>
                    {c.type === 'percent' ? `${c.value}% off` : `$${c.value.toFixed(2)} off`}
                    {c.minOrderValue > 0 ? ` · min $${c.minOrderValue.toFixed(2)}` : ''}
                  </Text>
                </View>
                <View style={cp.cardActions}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => openEdit(c)}
                    style={cp.iconBtn}
                    android_ripple={{ color: Colors.accentMuted, borderless: false }}
                  >
                    <Ionicons name="pencil-outline" size={16} color={Colors.accent} />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => handleDelete(c)}
                    style={cp.iconBtn}
                    android_ripple={{ color: Colors.errorBg, borderless: false }}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </Pressable>
                </View>
              </View>

              {/* Usage bar */}
              <View style={cp.usageRow}>
                <View style={cp.usageTrack}>
                  {usagePct !== null ? (
                    <View
                      style={[
                        cp.usageFill,
                        {
                          width: `${usagePct * 100}%`,
                          backgroundColor:
                            usagePct >= 0.9 ? Colors.error
                            : usagePct >= 0.6 ? Colors.warning
                            : Colors.success,
                        },
                      ]}
                    />
                  ) : (
                    <View style={[cp.usageFill, { width: '100%', backgroundColor: Colors.border }]} />
                  )}
                </View>
                <Text style={cp.usageText}>
                  {c.usedCount} used{c.maxUses != null ? ` / ${c.maxUses}` : ' (unlimited)'}
                </Text>
              </View>

              {c.expiresAt && (
                <Text style={[cp.expiryText, expired && { color: Colors.error }]}>
                  Expires {new Date(c.expiresAt).toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              )}

              <View style={cp.toggleRow}>
                <Text style={cp.toggleLabel}>{c.active ? 'Active' : 'Inactive'}</Text>
                <Switch
                  value={c.active}
                  onValueChange={() => handleToggle(c)}
                  trackColor={{ false: Colors.border, true: Colors.accentLight }}
                  thumbColor={c.active ? Colors.accent : Colors.white}
                />
              </View>
            </View>
            </ReAnimated.View>
          );
        }}
      />

      {/* Create / Edit Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
          <Pressable style={cp.backdrop} onPress={() => setModal(false)} />
          <ScrollView
            style={cp.sheet}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={cp.sheetHandle} />
            <Text style={cp.sheetTitle}>{editing ? 'Edit Coupon' : 'New Coupon Code'}</Text>

            {/* Code */}
            {!editing && (
              <>
                <Text style={cp.label}>Code * (auto-uppercased)</Text>
                <TextInput
                  style={[cp.input, errors.code && cp.inputError]}
                  value={form.code}
                  onChangeText={v => setForm(f => ({ ...f, code: v.toUpperCase() }))}
                  placeholder="e.g. SUMMER20"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                />
                {errors.code && <Text style={cp.err}>{errors.code}</Text>}
              </>
            )}
            {editing && <Text style={cp.codePreview}>{editing.code}</Text>}

            {/* Type */}
            {!editing && (
              <>
                <Text style={cp.label}>Discount Type</Text>
                <View style={cp.typeRow}>
                  {(['percent', 'fixed'] as CouponType[]).map(t => (
                    <Pressable
                      key={t}
                      style={[cp.typeBtn, form.type === t && cp.typeBtnActive]}
                      onPress={() => setForm(f => ({ ...f, type: t }))}
                      android_ripple={{ color: Colors.accentMuted }}
                    >
                      <Text style={[cp.typeBtnText, form.type === t && { color: Colors.accent }]}>
                        {t === 'percent' ? '% Percentage' : '$ Fixed Amount'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Value */}
            <Text style={cp.label}>
              Value * {form.type === 'percent' ? '(%)' : '(TTD)'}
            </Text>
            <TextInput
              style={[cp.input, errors.value && cp.inputError]}
              value={form.value}
              onChangeText={v => setForm(f => ({ ...f, value: v }))}
              keyboardType="decimal-pad"
              placeholder={form.type === 'percent' ? '10' : '15.00'}
              placeholderTextColor={Colors.textMuted}
            />
            {errors.value && <Text style={cp.err}>{errors.value}</Text>}

            {/* Min order */}
            <Text style={cp.label}>Minimum Order Value (optional)</Text>
            <TextInput
              style={cp.input}
              value={form.minOrderValue}
              onChangeText={v => setForm(f => ({ ...f, minOrderValue: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />

            {/* Expiry */}
            <Text style={cp.label}>Expiry Date (YYYY-MM-DD, optional)</Text>
            <TextInput
              style={[cp.input, errors.expiresAt && cp.inputError]}
              value={form.expiresAt}
              onChangeText={v => setForm(f => ({ ...f, expiresAt: v }))}
              placeholder="2025-12-31"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            {errors.expiresAt && <Text style={cp.err}>{errors.expiresAt}</Text>}

            {/* Max uses */}
            <Text style={cp.label}>Max Uses (leave blank for unlimited)</Text>
            <TextInput
              style={cp.input}
              value={form.maxUses}
              onChangeText={v => setForm(f => ({ ...f, maxUses: v }))}
              keyboardType="numeric"
              placeholder="Unlimited"
              placeholderTextColor={Colors.textMuted}
            />

            <View style={cp.sheetBtns}>
              <Pressable
                style={cp.sheetCancel}
                onPress={() => setModal(false)}
                android_ripple={{ color: Colors.border }}
              >
                <Text style={cp.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[cp.sheetConfirm, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                android_ripple={{ color: Colors.accentDark }}
              >
                <Text style={cp.sheetConfirmText}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Create Code'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const cp = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },

  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadow,
  },

  emptyWrap:  { alignItems: 'center', paddingTop: 64, gap: 12 },
  emptyIcon:  {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  empty:      { color: Colors.textMuted, textAlign: 'center', fontSize: 13 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  codeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  code:       { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 1.5 },
  valueLine:  { fontSize: 13, color: Colors.textSecondary },
  cardActions:{ flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  expiredBadge: {
    backgroundColor: Colors.errorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expiredText: { fontSize: 10, fontWeight: '700', color: Colors.error },

  usageRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  usageTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageFill:  { height: 6, borderRadius: 3 },
  usageText:  { fontSize: 11, color: Colors.textSecondary },
  expiryText: { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceAlt,
    paddingTop: 10,
    marginTop: 4,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle:  { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  codePreview: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  inputError: { borderColor: Colors.error },
  err:        { fontSize: 11, color: Colors.error, marginTop: 4 },
  typeRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  typeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
  },
  typeBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  typeBtnText:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  sheetBtns:       { flexDirection: 'row', gap: 12, marginTop: 24 },
  sheetCancel: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  sheetCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  sheetConfirm: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  sheetConfirmText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
