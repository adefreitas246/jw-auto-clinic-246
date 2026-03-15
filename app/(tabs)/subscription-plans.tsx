// app/(tabs)/subscription-plans.tsx
// Admin subscription plan management — create, edit, toggle, reorder.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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

type Plan = {
  _id:         string;
  name:        string;
  description: string;
  price:       number;
  currency:    string;
  jobQuota:    number | null;
  features:    string[];
  highlighted: boolean;
  sortOrder:   number;
  active:      boolean;
};

type FormState = {
  name:        string;
  description: string;
  price:       string;
  currency:    string;
  jobQuota:    string;    // '' = unlimited
  features:    string;   // newline-separated
  highlighted: boolean;
  sortOrder:   string;
};

const BLANK: FormState = {
  name: '', description: '', price: '', currency: 'TTD',
  jobQuota: '', features: '', highlighted: false, sortOrder: '0',
};

export default function SubscriptionPlansScreen() {
  const { token } = useAuth();
  const router    = useRouter();

  const [plans,      setPlans]      = useState<Plan[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal,      setModal]      = useState(false);
  const [editing,    setEditing]    = useState<Plan | null>(null);
  const [form,       setForm]       = useState<FormState>(BLANK);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState<Partial<FormState>>({});

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get<Plan[]>('/api/subscriptions/plans', { headers });
      setPlans(res.data);
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

  function openEdit(plan: Plan) {
    setEditing(plan);
    setForm({
      name:        plan.name,
      description: plan.description ?? '',
      price:       String(plan.price),
      currency:    plan.currency ?? 'TTD',
      jobQuota:    plan.jobQuota == null ? '' : String(plan.jobQuota),
      features:    (plan.features ?? []).join('\n'),
      highlighted: plan.highlighted ?? false,
      sortOrder:   String(plan.sortOrder ?? 0),
    });
    setErrors({});
    setModal(true);
  }

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!form.name.trim())           e.name  = 'Name is required.';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0)
      e.price = 'Enter a valid price.';
    if (form.jobQuota && isNaN(Number(form.jobQuota)))
      e.jobQuota = 'Enter a number or leave blank for unlimited.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        price:       Number(form.price),
        currency:    form.currency.trim() || 'TTD',
        jobQuota:    form.jobQuota ? Number(form.jobQuota) : null,
        features:    form.features.split('\n').map(f => f.trim()).filter(Boolean),
        highlighted: form.highlighted,
        sortOrder:   Number(form.sortOrder) || 0,
      };
      if (editing) {
        await axios.patch(`/api/subscriptions/plans/${editing._id}`, payload, { headers });
      } else {
        await axios.post('/api/subscriptions/plans', payload, { headers });
      }
      setModal(false);
      load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(plan: Plan) {
    try {
      await axios.patch(`/api/subscriptions/plans/${plan._id}`, { active: !plan.active }, { headers });
      load();
    } catch {}
  }

  async function handleDelete(plan: Plan) {
    Alert.alert(
      'Deactivate Plan',
      `Deactivate "${plan.name}"? Existing subscribers keep access until their renewal.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate', style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/api/subscriptions/plans/${plan._id}`, { headers });
              load();
            } catch {}
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={st.center}>
        <Text style={st.muted}>Loading plans…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </Pressable>
        <Text style={st.headerTitle}>Subscription Plans</Text>
        <Pressable onPress={openCreate} style={st.addBtn} hitSlop={8}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6a0dad" />}
        showsVerticalScrollIndicator={false}
      >
        {plans.length === 0 ? (
          <View style={st.emptyWrap}>
            <Ionicons name="card-outline" size={48} color="#d1d5db" />
            <Text style={st.emptyTitle}>No plans yet</Text>
            <Text style={st.empty}>Tap + to create your first subscription plan.</Text>
          </View>
        ) : (
          plans.map(plan => (
            <View key={plan._id} style={[st.planCard, !plan.active && { opacity: 0.5 }]}>
              <View style={st.planTop}>
                <View style={{ flex: 1 }}>
                  <View style={st.planNameRow}>
                    <Text style={st.planName}>{plan.name}</Text>
                    {plan.highlighted && <Text style={st.popularTag}>⭐ Popular</Text>}
                  </View>
                  <Text style={st.planPrice}>
                    {plan.currency} {plan.price.toFixed(2)}/mo
                  </Text>
                </View>
                <View style={st.planActions}>
                  <Pressable onPress={() => openEdit(plan)} hitSlop={8} style={st.iconBtn}>
                    <Ionicons name="pencil-outline" size={17} color="#6a0dad" />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(plan)} hitSlop={8} style={st.iconBtn}>
                    <Ionicons name="trash-outline" size={17} color="#ef4444" />
                  </Pressable>
                </View>
              </View>

              {plan.description ? <Text style={st.planDesc}>{plan.description}</Text> : null}

              <View style={st.planMeta}>
                <View style={st.metaChip}>
                  <Ionicons name="car-outline" size={12} color="#6b7280" />
                  <Text style={st.metaText}>
                    {plan.jobQuota == null ? 'Unlimited' : `${plan.jobQuota} washes`}
                  </Text>
                </View>
                <View style={st.metaChip}>
                  <Ionicons name="list-outline" size={12} color="#6b7280" />
                  <Text style={st.metaText}>{plan.features?.length ?? 0} features</Text>
                </View>
                <View style={st.metaChip}>
                  <Ionicons name="swap-vertical-outline" size={12} color="#6b7280" />
                  <Text style={st.metaText}>Order {plan.sortOrder}</Text>
                </View>
              </View>

              <View style={st.toggleRow}>
                <Text style={st.toggleLabel}>{plan.active ? 'Active' : 'Inactive'}</Text>
                <Switch
                  value={plan.active}
                  onValueChange={() => handleToggle(plan)}
                  trackColor={{ false: '#d1d5db', true: '#a855f7' }}
                  thumbColor={plan.active ? '#6a0dad' : '#fff'}
                />
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={st.backdrop} onPress={() => setModal(false)} />
          <ScrollView style={st.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={st.sheetTitle}>{editing ? 'Edit Plan' : 'New Plan'}</Text>

            {/* Name */}
            <Text style={st.label}>Plan Name *</Text>
            <TextInput style={[st.input, errors.name && st.inputError]} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Basic, Premium" placeholderTextColor="#9ca3af" />
            {errors.name && <Text style={st.err}>{errors.name}</Text>}

            {/* Price */}
            <Text style={st.label}>Price *</Text>
            <View style={st.priceRow}>
              <TextInput style={[st.input, st.currencyInput]} value={form.currency} onChangeText={v => setForm(f => ({ ...f, currency: v }))} placeholder="TTD" placeholderTextColor="#9ca3af" maxLength={4} />
              <TextInput style={[st.input, { flex: 1 }, errors.price && st.inputError]} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9ca3af" />
            </View>
            {errors.price && <Text style={st.err}>{errors.price}</Text>}

            {/* Description */}
            <Text style={st.label}>Description</Text>
            <TextInput style={[st.input, { minHeight: 60 }]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Short description shown on plan card" placeholderTextColor="#9ca3af" multiline textAlignVertical="top" />

            {/* Job quota */}
            <Text style={st.label}>Washes per Month</Text>
            <TextInput style={[st.input, errors.jobQuota && st.inputError]} value={form.jobQuota} onChangeText={v => setForm(f => ({ ...f, jobQuota: v }))} keyboardType="numeric" placeholder="Leave blank for unlimited" placeholderTextColor="#9ca3af" />
            {errors.jobQuota && <Text style={st.err}>{errors.jobQuota}</Text>}

            {/* Features */}
            <Text style={st.label}>Feature Bullets (one per line)</Text>
            <TextInput style={[st.input, { minHeight: 90 }]} value={form.features} onChangeText={v => setForm(f => ({ ...f, features: v }))} placeholder={'Free interior vacuum\n24/7 support\nPriority booking'} placeholderTextColor="#9ca3af" multiline textAlignVertical="top" />

            {/* Sort order */}
            <Text style={st.label}>Display Order</Text>
            <TextInput style={st.input} value={form.sortOrder} onChangeText={v => setForm(f => ({ ...f, sortOrder: v }))} keyboardType="numeric" placeholder="0 = first" placeholderTextColor="#9ca3af" />

            {/* Highlighted */}
            <View style={st.switchRow}>
              <View>
                <Text style={st.switchLabel}>Mark as "Most Popular"</Text>
                <Text style={st.switchSub}>Shows a star badge on the plan card.</Text>
              </View>
              <Switch
                value={form.highlighted}
                onValueChange={v => setForm(f => ({ ...f, highlighted: v }))}
                trackColor={{ false: '#d1d5db', true: '#a855f7' }}
                thumbColor={form.highlighted ? '#6a0dad' : '#fff'}
              />
            </View>

            {/* Buttons */}
            <View style={st.sheetBtns}>
              <Pressable style={st.sheetCancel} onPress={() => setModal(false)}>
                <Text style={{ color: '#6b7280', fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable style={[st.sheetConfirm, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Plan'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  muted:  { color: '#9ca3af', fontSize: 14 },
  empty:  { color: '#9ca3af', textAlign: 'center', fontSize: 13, marginTop: 6 },
  emptyWrap:  { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6b7280' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  addBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6a0dad', justifyContent: 'center', alignItems: 'center' },

  planCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  planTop:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  planName:    { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  popularTag:  { fontSize: 10, color: '#6a0dad', fontWeight: '600', backgroundColor: '#f5f0ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  planPrice:   { fontSize: 14, color: '#6a0dad', fontWeight: '600' },
  planDesc:    { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  planActions: { flexDirection: 'row', gap: 6 },
  iconBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
  planMeta:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f9fafb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaText:    { fontSize: 11, color: '#6b7280' },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },

  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 16 },

  label:       { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 10 },
  input:       { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  inputError:  { borderColor: '#ef4444' },
  err:         { fontSize: 11, color: '#ef4444', marginTop: 3 },
  priceRow:    { flexDirection: 'row', gap: 8 },
  currencyInput: { width: 60 },

  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  switchSub:   { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  sheetBtns:    { flexDirection: 'row', gap: 12, marginTop: 20 },
  sheetCancel:  { flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center' },
  sheetConfirm: { flex: 1, padding: 14, backgroundColor: '#6a0dad', borderRadius: 10, alignItems: 'center' },
});
