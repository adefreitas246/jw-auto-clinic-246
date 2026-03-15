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
  expiresAt:     string;  // YYYY-MM-DD or ''
  maxUses:       string;  // '' = unlimited
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
    if (!form.code.trim())                           e.code  = 'Code is required.';
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
        await axios.patch(`/api/marketing/coupons/${editing._id}`,
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
      <View style={cp.header}>
        <Pressable onPress={() => router.back()} style={cp.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </Pressable>
        <Text style={cp.headerTitle}>Coupon Codes</Text>
        <Pressable onPress={openCreate} style={cp.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={coupons}
        keyExtractor={c => c._id}
        contentContainerStyle={cp.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6a0dad" />}
        ListEmptyComponent={
          <View style={cp.emptyWrap}>
            <Ionicons name="pricetag-outline" size={48} color="#d1d5db" />
            <Text style={cp.emptyTitle}>No coupons yet</Text>
            <Text style={cp.empty}>Tap + to create your first discount code.</Text>
          </View>
        }
        renderItem={({ item: c }) => {
          const expired = isExpired(c);
          const full    = isFull(c);
          const usagePct = c.maxUses ? Math.min(1, c.usedCount / c.maxUses) : null;

          return (
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
                  <Pressable hitSlop={8} onPress={() => openEdit(c)} style={cp.iconBtn}>
                    <Ionicons name="pencil-outline" size={16} color="#6a0dad" />
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => handleDelete(c)} style={cp.iconBtn}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              </View>

              {/* Usage bar */}
              <View style={cp.usageRow}>
                <View style={cp.usageTrack}>
                  {usagePct !== null ? (
                    <View style={[cp.usageFill, { width: `${usagePct * 100}%`, backgroundColor: usagePct >= 0.9 ? '#ef4444' : usagePct >= 0.6 ? '#f59e0b' : '#10b981' }]} />
                  ) : (
                    <View style={[cp.usageFill, { width: '100%', backgroundColor: '#e5e7eb' }]} />
                  )}
                </View>
                <Text style={cp.usageText}>
                  {c.usedCount} used{c.maxUses != null ? ` / ${c.maxUses}` : ' (unlimited)'}
                </Text>
              </View>

              {c.expiresAt && (
                <Text style={[cp.expiryText, expired && { color: '#ef4444' }]}>
                  Expires {new Date(c.expiresAt).toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              )}

              <View style={cp.toggleRow}>
                <Text style={cp.toggleLabel}>{c.active ? 'Active' : 'Inactive'}</Text>
                <Switch
                  value={c.active}
                  onValueChange={() => handleToggle(c)}
                  trackColor={{ false: '#d1d5db', true: '#a855f7' }}
                  thumbColor={c.active ? '#6a0dad' : '#fff'}
                />
              </View>
            </View>
          );
        }}
      />

      {/* Create / Edit Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={cp.backdrop} onPress={() => setModal(false)} />
          <ScrollView style={cp.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={cp.sheetTitle}>{editing ? 'Edit Coupon' : 'New Coupon Code'}</Text>

            {/* Code */}
            {!editing && (
              <>
                <Text style={cp.label}>Code * (auto-uppercased)</Text>
                <TextInput style={[cp.input, errors.code && cp.inputError]} value={form.code} onChangeText={v => setForm(f => ({ ...f, code: v.toUpperCase() }))} placeholder="e.g. SUMMER20" placeholderTextColor="#9ca3af" autoCapitalize="characters" />
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
                    >
                      <Text style={[cp.typeBtnText, form.type === t && { color: '#6a0dad' }]}>
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
            <TextInput style={[cp.input, errors.value && cp.inputError]} value={form.value} onChangeText={v => setForm(f => ({ ...f, value: v }))} keyboardType="decimal-pad" placeholder={form.type === 'percent' ? '10' : '15.00'} placeholderTextColor="#9ca3af" />
            {errors.value && <Text style={cp.err}>{errors.value}</Text>}

            {/* Min order */}
            <Text style={cp.label}>Minimum Order Value (optional)</Text>
            <TextInput style={cp.input} value={form.minOrderValue} onChangeText={v => setForm(f => ({ ...f, minOrderValue: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9ca3af" />

            {/* Expiry */}
            <Text style={cp.label}>Expiry Date (YYYY-MM-DD, optional)</Text>
            <TextInput style={[cp.input, errors.expiresAt && cp.inputError]} value={form.expiresAt} onChangeText={v => setForm(f => ({ ...f, expiresAt: v }))} placeholder="2025-12-31" placeholderTextColor="#9ca3af" keyboardType="numbers-and-punctuation" />
            {errors.expiresAt && <Text style={cp.err}>{errors.expiresAt}</Text>}

            {/* Max uses */}
            <Text style={cp.label}>Max Uses (leave blank for unlimited)</Text>
            <TextInput style={cp.input} value={form.maxUses} onChangeText={v => setForm(f => ({ ...f, maxUses: v }))} keyboardType="numeric" placeholder="Unlimited" placeholderTextColor="#9ca3af" />

            <View style={cp.sheetBtns}>
              <Pressable style={cp.sheetCancel} onPress={() => setModal(false)}>
                <Text style={{ color: '#6b7280', fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable style={[cp.sheetConfirm, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : editing ? 'Update' : 'Create Code'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const cp = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 16 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  addBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6a0dad', justifyContent: 'center', alignItems: 'center' },

  emptyWrap:  { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  empty:      { color: '#9ca3af', textAlign: 'center', fontSize: 13 },

  card:       { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  codeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  code:       { fontSize: 18, fontWeight: '800', color: '#1f2937', letterSpacing: 1.5 },
  valueLine:  { fontSize: 13, color: '#6b7280' },
  cardActions: { flexDirection: 'row', gap: 6 },
  iconBtn:    { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
  expiredBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  expiredText:  { fontSize: 10, fontWeight: '700', color: '#ef4444' },

  usageRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  usageTrack: { flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  usageFill:  { height: 6, borderRadius: 3 },
  usageText:  { fontSize: 11, color: '#6b7280' },
  expiryText: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },

  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  sheetTitle:   { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 14 },
  codePreview:  { fontSize: 22, fontWeight: '800', color: '#6a0dad', letterSpacing: 2, marginBottom: 14, textAlign: 'center' },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 10 },
  input:        { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 11, fontSize: 14, color: '#111827' },
  inputError:   { borderColor: '#ef4444' },
  err:          { fontSize: 11, color: '#ef4444', marginTop: 3 },
  typeRow:      { flexDirection: 'row', gap: 8, marginTop: 6 },
  typeBtn:      { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#f9fafb' },
  typeBtnActive: { borderColor: '#6a0dad', backgroundColor: '#f5f0ff' },
  typeBtnText:  { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  sheetBtns:    { flexDirection: 'row', gap: 12, marginTop: 20 },
  sheetCancel:  { flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center' },
  sheetConfirm: { flex: 1, padding: 14, backgroundColor: '#6a0dad', borderRadius: 10, alignItems: 'center' },
});
