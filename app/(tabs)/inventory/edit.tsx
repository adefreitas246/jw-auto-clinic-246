// app/(tabs)/inventory/edit.tsx — Add / Edit Inventory Item
//
// Route params:
//   ?id=<objectId>   → edit mode (fetches existing item)
//   (no params)      → create mode
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import axios from 'axios';
import { useInventoryCache } from '@/hooks/useInventoryCache';
import { Colors } from '@/constants/Colors';
import { IS_IOS, IS_ANDROID } from '@/utils/platform';
import { SCREEN_PADDING } from '@/utils/platformStyles';
import { ScreenHeader } from '@/components/ui';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Soaps & Chemicals',
  'Wax & Polish',
  'Interior Care',
  'Towels & Cloths',
  'Disposables',
  'Equipment',
  'Other',
];

const UNITS = ['units', 'pcs', 'ml', 'L', 'g', 'kg', 'rolls', 'sheets', 'bottles', 'boxes'];

// ── Picker modal ──────────────────────────────────────────────────────────────

function PickerModal({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title:   string;
  options: string[];
  value:   string;
  onSelect:(v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pm.overlay} onPress={onClose} />
      <View style={pm.sheet}>
        <View style={pm.handle} />
        <Text style={pm.title}>{title}</Text>
        <ScrollView>
          {options.map(opt => (
            <Pressable
              key={opt}
              style={[pm.option, value === opt && pm.optionActive]}
              onPress={() => { onSelect(opt); onClose(); }}
            >
              <Text style={[pm.optionText, value === opt && pm.optionTextActive]}>{opt}</Text>
              {value === opt && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 32, maxHeight: '60%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginVertical: 12,
  },
  title:           { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  option:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.surfaceAlt },
  optionActive:    { backgroundColor: Colors.accentMuted, borderRadius: 8, paddingHorizontal: 8 },
  optionText:      { fontSize: 15, color: Colors.textSecondary },
  optionTextActive:{ color: Colors.accent, fontWeight: '700' },
});

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>
        {label}{required && <Text style={{ color: Colors.error }}> *</Text>}
      </Text>
      {children}
      {error ? <Text style={f.error}>{error}</Text> : null}
    </View>
  );
}

const f = StyleSheet.create({
  wrap:  { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  error: { fontSize: 11, color: Colors.error, marginTop: 4 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EditInventoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit  = !!id;
  const cache   = useInventoryCache();

  // Form state
  const [name,      setName]      = useState('');
  const [category,  setCategory]  = useState('Other');
  const [stock,     setStock]     = useState('0');
  const [unit,      setUnit]      = useState('units');
  const [threshold, setThreshold] = useState('10');
  const [notes,     setNotes]     = useState('');

  // UI state
  const [loading,      setLoading]      = useState(isEdit);
  const [saving,       setSaving]       = useState(false);
  const [catPicker,    setCatPicker]    = useState(false);
  const [unitPicker,   setUnitPicker]   = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  // ── Load existing item ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data } = await axios.get(`/api/inventory/${id}`);
        setName(data.name ?? '');
        setCategory(data.category ?? 'Other');
        setStock(String(data.currentStock ?? 0));
        setUnit(data.unit ?? 'units');
        setThreshold(String(data.lowStockThreshold ?? 10));
        setNotes(data.notes ?? '');
      } catch {
        // Fall back to cache if offline
        const cached = await cache.readAll();
        const item   = cached.find(it => it._id === id);
        if (item) {
          setName(item.name);
          setCategory(item.category);
          setStock(String(item.currentStock));
          setUnit(item.unit);
          setThreshold(String(item.lowStockThreshold));
          setNotes(item.notes ?? '');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Validate ────────────────────────────────────────────────────────────────

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim())             errs.name      = 'Name is required.';
    if (isNaN(Number(stock)))     errs.stock     = 'Must be a number.';
    if (!unit.trim())             errs.unit      = 'Unit is required.';
    if (isNaN(Number(threshold)) || Number(threshold) < 0) {
      errs.threshold = 'Must be a non-negative number.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name:              name.trim(),
        category,
        currentStock:      Number(stock),
        unit:              unit.trim(),
        lowStockThreshold: Number(threshold),
        notes:             notes.trim(),
      };

      const { data } = isEdit
        ? await axios.patch(`/api/inventory/${id}`, payload)
        : await axios.post('/api/inventory', payload);

      await cache.upsertOne(data);
      router.back();
    } catch (e: any) {
      const msg = e.response?.data?.error ?? 'Save failed.';
      if (msg.includes('already exists')) {
        setErrors(prev => ({ ...prev, name: 'An item with this name already exists.' }));
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={es.safe} edges={['top']}>
        <View style={es.centered}><ActivityIndicator size="large" color={Colors.accent} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={es.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={IS_IOS ? 'padding' : undefined}
      >
        <ScreenHeader
          title={isEdit ? 'Edit Item' : 'Add Item'}
          backButton
          rightAction={
            <Pressable
              style={({ pressed }) => [es.saveBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={es.saveBtnText}>Save</Text>
              }
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={es.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <Field label="Item Name" required error={errors.name}>
            <TextInput
              style={[es.input, errors.name && es.inputError]}
              value={name}
              onChangeText={v => { setName(v); setErrors(p => ({ ...p, name: '' })); }}
              placeholder="e.g. Car Shampoo Concentrate"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="next"
              autoCapitalize="words"
            />
          </Field>

          {/* Category picker */}
          <Field label="Category">
            <Pressable style={es.pickerBtn} onPress={() => setCatPicker(true)}>
              <Text style={es.pickerText}>{category}</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
            </Pressable>
          </Field>

          {/* Stock + Unit row */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Current Stock" required error={errors.stock}>
                <TextInput
                  style={[es.input, errors.stock && es.inputError]}
                  value={stock}
                  onChangeText={v => { setStock(v); setErrors(p => ({ ...p, stock: '' })); }}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Unit" required error={errors.unit}>
                <Pressable style={es.pickerBtn} onPress={() => setUnitPicker(true)}>
                  <Text style={es.pickerText}>{unit}</Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                </Pressable>
              </Field>
            </View>
          </View>

          {/* Threshold */}
          <Field label="Low Stock Threshold" required error={errors.threshold}>
            <TextInput
              style={[es.input, errors.threshold && es.inputError]}
              value={threshold}
              onChangeText={v => { setThreshold(v); setErrors(p => ({ ...p, threshold: '' })); }}
              keyboardType="decimal-pad"
              returnKeyType="next"
              placeholder="10"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={es.hint}>
              Push notification fires when stock drops below this value.
            </Text>
          </Field>

          {/* Notes */}
          <Field label="Notes (optional)">
            <TextInput
              style={[es.input, es.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Supplier, storage location, etc."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
          </Field>

          {/* Stock level preview */}
          {name.trim() !== '' && (
            <View style={es.preview}>
              <Text style={es.previewLabel}>Stock Preview</Text>
              <View style={es.previewRow}>
                {(
                  [
                    { label: 'Out (0)',          stock: 0 },
                    { label: `Low (<${threshold})`, stock: Math.max(Number(threshold) * 0.5, 0) },
                    { label: `Watch`,              stock: Math.max(Number(threshold) * 1.2, 0) },
                    { label: 'OK',                 stock: Math.max(Number(threshold) * 2, 0) },
                  ] as const
                ).map(({ label, stock: s }) => {
                  const t = Number(threshold) || 10;
                  let level: 'out' | 'low' | 'warn' | 'ok' = 'ok';
                  if (s <= 0)      level = 'out';
                  else if (s < t)  level = 'low';
                  else if (s < t * 1.75) level = 'warn';
                  const colors = { ok: Colors.success, warn: Colors.warning, low: Colors.error, out: Colors.accent };
                  return (
                    <View key={label} style={es.previewPill}>
                      <View style={[es.dot, { backgroundColor: colors[level] }]} />
                      <Text style={es.previewPillText}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <PickerModal
        visible={catPicker}
        title="Select Category"
        options={CATEGORIES}
        value={category}
        onSelect={setCategory}
        onClose={() => setCatPicker(false)}
      />
      <PickerModal
        visible={unitPicker}
        title="Select Unit"
        options={UNITS}
        value={unit}
        onSelect={setUnit}
        onClose={() => setUnitPicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SHADOW = IS_IOS
  ? { shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }
  : IS_ANDROID ? { elevation: 2 } : {};

const es = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 9,
    minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  scroll: { paddingHorizontal: SCREEN_PADDING, paddingTop: 8, paddingBottom: 100 },

  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.white,
    ...SHADOW,
  },
  inputError: { borderColor: Colors.error },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: 11 },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.white, ...SHADOW,
  },
  pickerText: { fontSize: 15, color: Colors.textPrimary },

  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  preview: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, ...SHADOW },
  previewLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surfaceAlt, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  previewPillText: { fontSize: 11, color: Colors.textSecondary },
});
