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
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { SCREEN_PADDING } from '@/utils/platformStyles';

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
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>Subscription Plans</Text>
        <Pressable onPress={openCreate} style={st.addBtn} hitSlop={8}>
          <Ionicons name="add" size={20} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {plans.length === 0 ? (
          <View style={st.emptyWrap}>
            <Ionicons name="card-outline" size={48} color={Colors.border} />
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
                    <Ionicons name="pencil-outline" size={17} color={Colors.accent} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(plan)} hitSlop={8} style={st.iconBtn}>
                    <Ionicons name="trash-outline" size={17} color={Colors.error} />
                  </Pressable>
                </View>
              </View>

              {plan.description ? <Text style={st.planDesc}>{plan.description}</Text> : null}

              <View style={st.planMeta}>
                <View style={st.metaChip}>
                  <Ionicons name="car-outline" size={12} color={Colors.textSecondary} />
                  <Text style={st.metaText}>
                    {plan.jobQuota == null ? 'Unlimited' : `${plan.jobQuota} washes`}
                  </Text>
                </View>
                <View style={st.metaChip}>
                  <Ionicons name="list-outline" size={12} color={Colors.textSecondary} />
                  <Text style={st.metaText}>{plan.features?.length ?? 0} features</Text>
                </View>
                <View style={st.metaChip}>
                  <Ionicons name="swap-vertical-outline" size={12} color={Colors.textSecondary} />
                  <Text style={st.metaText}>Order {plan.sortOrder}</Text>
                </View>
              </View>

              <View style={st.toggleRow}>
                <Text style={st.toggleLabel}>{plan.active ? 'Active' : 'Inactive'}</Text>
                <Switch
                  value={plan.active}
                  onValueChange={() => handleToggle(plan)}
                  trackColor={{ false: Colors.border, true: Colors.accentLight }}
                  thumbColor={plan.active ? Colors.accent : Colors.white}
                />
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
          <Pressable style={st.backdrop} onPress={() => setModal(false)} />
          <ScrollView style={st.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={st.sheetTitle}>{editing ? 'Edit Plan' : 'New Plan'}</Text>

            {/* Name */}
            <Text style={st.label}>Plan Name *</Text>
            <TextInput style={[st.input, errors.name && st.inputError]} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Basic, Premium" placeholderTextColor={Colors.textMuted} />
            {errors.name && <Text style={st.err}>{errors.name}</Text>}

            {/* Price */}
            <Text style={st.label}>Price *</Text>
            <View style={st.priceRow}>
              <TextInput style={[st.input, st.currencyInput]} value={form.currency} onChangeText={v => setForm(f => ({ ...f, currency: v }))} placeholder="TTD" placeholderTextColor={Colors.textMuted} maxLength={4} />
              <TextInput style={[st.input, { flex: 1 }, errors.price && st.inputError]} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.textMuted} />
            </View>
            {errors.price && <Text style={st.err}>{errors.price}</Text>}

            {/* Description */}
            <Text style={st.label}>Description</Text>
            <TextInput style={[st.input, { minHeight: 60 }]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Short description shown on plan card" placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" />

            {/* Job quota */}
            <Text style={st.label}>Washes per Month</Text>
            <TextInput style={[st.input, errors.jobQuota && st.inputError]} value={form.jobQuota} onChangeText={v => setForm(f => ({ ...f, jobQuota: v }))} keyboardType="numeric" placeholder="Leave blank for unlimited" placeholderTextColor={Colors.textMuted} />
            {errors.jobQuota && <Text style={st.err}>{errors.jobQuota}</Text>}

            {/* Features */}
            <Text style={st.label}>Feature Bullets (one per line)</Text>
            <TextInput style={[st.input, { minHeight: 90 }]} value={form.features} onChangeText={v => setForm(f => ({ ...f, features: v }))} placeholder={'Free interior vacuum\n24/7 support\nPriority booking'} placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" />

            {/* Sort order */}
            <Text style={st.label}>Display Order</Text>
            <TextInput style={st.input} value={form.sortOrder} onChangeText={v => setForm(f => ({ ...f, sortOrder: v }))} keyboardType="numeric" placeholder="0 = first" placeholderTextColor={Colors.textMuted} />

            {/* Highlighted */}
            <View style={st.switchRow}>
              <View>
                <Text style={st.switchLabel}>Mark as "Most Popular"</Text>
                <Text style={st.switchSub}>Shows a star badge on the plan card.</Text>
              </View>
              <Switch
                value={form.highlighted}
                onValueChange={v => setForm(f => ({ ...f, highlighted: v }))}
                trackColor={{ false: Colors.border, true: Colors.accentLight }}
                thumbColor={form.highlighted ? Colors.accent : Colors.white}
              />
            </View>

            {/* Buttons */}
            <View style={st.sheetBtns}>
              <Pressable style={st.sheetCancel} onPress={() => setModal(false)}>
                <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable style={[st.sheetConfirm, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={{ color: Colors.white, fontWeight: '700' }}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Plan'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.surfaceAlt },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SCREEN_PADDING },
  muted:  { color: Colors.textMuted, fontSize: 14 },
  empty:  { color: Colors.textMuted, textAlign: 'center', fontSize: 13, marginTop: 6 },
  emptyWrap:  { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN_PADDING, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  addBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },

  planCard:    { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.black, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  planTop:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  planName:    { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  popularTag:  { fontSize: 10, color: Colors.accent, fontWeight: '600', backgroundColor: Colors.accentMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  planPrice:   { fontSize: 14, color: Colors.accent, fontWeight: '600' },
  planDesc:    { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  planActions: { flexDirection: 'row', gap: 6 },
  iconBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  planMeta:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaText:    { fontSize: 11, color: Colors.textSecondary },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.surfaceAlt, paddingTop: 10 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },

  label:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, marginTop: 10 },
  input:       { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 11, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.white },
  inputError:  { borderColor: Colors.error },
  err:         { fontSize: 11, color: Colors.error, marginTop: 3 },
  priceRow:    { flexDirection: 'row', gap: 8 },
  currencyInput: { width: 60 },

  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  switchSub:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  sheetBtns:    { flexDirection: 'row', gap: 12, marginTop: 20 },
  sheetCancel:  { flex: 1, padding: 14, backgroundColor: Colors.surfaceAlt, borderRadius: 10, alignItems: 'center' },
  sheetConfirm: { flex: 1, padding: 14, backgroundColor: Colors.accent, borderRadius: 10, alignItems: 'center' },
});
