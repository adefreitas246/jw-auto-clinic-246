// app/(tabs)/packages/_form.tsx — Package Builder (add/edit)
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Package, Service } from '@/types/catalog';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

interface Props { mode: 'add' | 'edit' }

export default function PackageFormScreen({ mode }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name,           setName]          = useState('');
  const [description,    setDescription]   = useState('');
  const [overridePrice,  setOverridePrice] = useState('');
  const [active,         setActive]        = useState(true);
  const [services,       setServices]      = useState<Service[]>([]);
  const [selectedIds,    setSelectedIds]   = useState<Set<string>>(new Set());
  const [loadingSvcs,    setLoadingSvcs]   = useState(true);
  const [saving,         setSaving]        = useState(false);

  // Load all services for the checklist
  useEffect(() => {
    axios.get<Service[]>('/api/services')
      .then(res => setServices(res.data.filter(s => s.active)))
      .catch(() => Alert.alert('Error', 'Could not load services.'))
      .finally(() => setLoadingSvcs(false));
  }, []);

  // Prefill form in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    axios.get<Package[]>('/api/packages').then(res => {
      const pkg = res.data.find(p => p._id === id);
      if (!pkg) return;
      setName(pkg.name);
      setDescription(pkg.description);
      setOverridePrice(pkg.price != null ? String(pkg.price) : '');
      setActive(pkg.active);
      setSelectedIds(new Set(pkg.serviceIds.map(s => s._id)));
    }).catch(() => Alert.alert('Error', 'Could not load package.'));
  }, [mode, id]);

  const toggleService = (svcId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(svcId) ? next.delete(svcId) : next.add(svcId);
      return next;
    });
  };

  const autoSum = services
    .filter(s => selectedIds.has(s._id))
    .reduce((acc, s) => acc + s.price, 0);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Package name is required.'); return; }
    if (selectedIds.size === 0) { Alert.alert('Validation', 'Select at least one service.'); return; }

    let price: number | null = null;
    if (overridePrice.trim()) {
      price = parseFloat(overridePrice);
      if (isNaN(price) || price < 0) { Alert.alert('Validation', 'Enter a valid price or leave blank for auto-sum.'); return; }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price,
        serviceIds: Array.from(selectedIds),
        active,
      };
      if (mode === 'add') {
        await axios.post('/api/packages', payload);
      } else {
        await axios.put(`/api/packages/${id}`, payload);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Could not save package.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Package info */}
        <Text style={s.sectionLabel}>Package Details</Text>
        <View style={s.card}>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Package Name <Text style={s.required}>*</Text></Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ultimate Detail Package"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={s.divider} />

          <View style={s.fieldWrap}>
            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Briefly describe what's included…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Service checklist */}
        <Text style={s.sectionLabel}>
          Included Services <Text style={s.required}>*</Text>
        </Text>

        {loadingSvcs ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={s.loadingText}>Loading services…</Text>
          </View>
        ) : services.length === 0 ? (
          <View style={[s.card, s.emptyCard]}>
            <Ionicons name="construct-outline" size={24} color={Colors.textMuted} />
            <Text style={s.hint}>No active services found. Create some services first.</Text>
          </View>
        ) : (
          <View style={s.checklist}>
            {services.map((svc, idx) => {
              const checked = selectedIds.has(svc._id);
              return (
                <Pressable
                  key={svc._id}
                  style={[
                    s.checkRow,
                    checked && s.checkRowActive,
                    idx < services.length - 1 && s.checkRowBorder,
                  ]}
                  onPress={() => toggleService(svc._id)}
                  android_ripple={{ color: Colors.accent + '12', borderless: false }}
                >
                  <View style={[s.checkBox, checked && s.checkBoxActive]}>
                    {checked && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                  </View>
                  <View style={s.checkBody}>
                    <Text style={[s.checkName, checked && s.checkNameActive]}>{svc.name}</Text>
                    <Text style={s.checkMeta}>
                      ${svc.price.toFixed(2)}  ·  {svc.duration} min  ·  {svc.category}
                    </Text>
                  </View>
                  {checked && (
                    <Text style={s.checkPrice}>${svc.price.toFixed(2)}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Auto-sum preview */}
        {selectedIds.size > 0 && (
          <View style={s.sumCard}>
            <View style={s.sumRow}>
              <View style={s.sumLeft}>
                <Text style={s.sumTitle}>Combined Price</Text>
                <Text style={s.sumSub}>{selectedIds.size} service{selectedIds.size !== 1 ? 's' : ''} selected</Text>
              </View>
              <Text style={s.sumValue}>${autoSum.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Override price */}
        <Text style={s.sectionLabel}>Override Price (optional)</Text>
        <View style={s.card}>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Custom Price</Text>
            <TextInput
              style={s.input}
              value={overridePrice}
              onChangeText={setOverridePrice}
              placeholder={`Leave blank to use auto-sum ($${autoSum.toFixed(2)})`}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
            <Text style={s.fieldHint}>
              Leave blank to automatically sum selected service prices.
            </Text>
          </View>
        </View>

        {/* Active toggle */}
        <View style={[s.card, s.switchCard]}>
          <View style={s.switchBody}>
            <Text style={s.switchTitle}>Active</Text>
            <Text style={s.switchSub}>Visible to customers when enabled</Text>
          </View>
          <Switch
            value={active}
            onValueChange={setActive}
            trackColor={{ true: Colors.accent, false: Colors.border }}
            thumbColor={Colors.white}
          />
        </View>

        {/* Save */}
        <Pressable
          style={({ pressed }) => [s.saveBtn, saving && s.saveBtnBusy, pressed && { opacity: 0.88 }]}
          onPress={handleSave}
          disabled={saving}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={s.saveBtnText}>{mode === 'add' ? 'Create Package' : 'Save Changes'}</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceAlt },
  content:   { paddingHorizontal: 20, paddingTop: 20, paddingBottom: SCROLL_PADDING_BOTTOM },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },
  required:     { color: Colors.error },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    ...cardShadow,
    marginBottom: 4,
    overflow: 'hidden',
  },
  fieldWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  divider:   { height: 1, backgroundColor: Colors.border },

  label:     { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt,
  },
  multiline:  { minHeight: 72, paddingTop: 10 },
  fieldHint:  { fontSize: 11, color: Colors.textMuted, marginTop: 6, lineHeight: 15 },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20 },
  loadingText: { fontSize: 14, color: Colors.textMuted },

  emptyCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  hint:        { fontSize: 13, color: Colors.textMuted, flex: 1 },

  // Checklist
  checklist:      { backgroundColor: Colors.surface, borderRadius: borderRadius.md, overflow: 'hidden', ...cardShadow, marginBottom: 4 },
  checkRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  checkRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkRowActive: { backgroundColor: Colors.accentMuted },
  checkBox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkBoxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkBody:      { flex: 1 },
  checkName:      { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  checkNameActive:{ color: Colors.accent },
  checkMeta:      { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  checkPrice:     { fontSize: 13, fontWeight: '700', color: Colors.accent, marginLeft: 8 },

  // Sum card
  sumCard: {
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  sumRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumLeft:  {},
  sumTitle: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  sumSub:   { fontSize: 12, color: Colors.accent, opacity: 0.7, marginTop: 2 },
  sumValue: { fontSize: 24, fontWeight: '800', color: Colors.accent },

  // Active toggle
  switchCard:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
  switchBody:  { flex: 1 },
  switchTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  switchSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Save button
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    ...cardShadow,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
