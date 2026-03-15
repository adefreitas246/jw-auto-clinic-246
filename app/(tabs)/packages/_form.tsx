// app/(tabs)/packages/_form.tsx — Package Builder (add/edit)
// Lets admins: name the package, pick services from a checklist,
// optionally override the combined price, toggle active.
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Package, Service } from '@/types/catalog';

interface Props { mode: 'add' | 'edit' }

export default function PackageFormScreen({ mode }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name,           setName]          = useState('');
  const [description,    setDescription]   = useState('');
  const [overridePrice,  setOverridePrice] = useState(''); // empty = auto-sum
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

  // Compute auto-sum from selected services
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <Text style={s.label}>Package Name *</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Ultimate Detail Package" autoCapitalize="words" />

        {/* Description */}
        <Text style={s.label}>Description</Text>
        <TextInput
          style={[s.input, s.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Briefly describe what's included…"
          multiline numberOfLines={2} textAlignVertical="top"
        />

        {/* Service checklist */}
        <Text style={s.label}>Included Services *</Text>
        {loadingSvcs ? (
          <ActivityIndicator color="#6a0dad" />
        ) : services.length === 0 ? (
          <Text style={s.hint}>No active services found. Create some services first.</Text>
        ) : (
          <View style={s.checklist}>
            {services.map(svc => {
              const checked = selectedIds.has(svc._id);
              return (
                <Pressable
                  key={svc._id}
                  style={[s.checkRow, checked && s.checkRowActive]}
                  onPress={() => toggleService(svc._id)}
                >
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked ? '#6a0dad' : '#ccc'}
                  />
                  <View style={s.checkBody}>
                    <Text style={[s.checkName, checked && s.checkNameActive]}>{svc.name}</Text>
                    <Text style={s.checkMeta}>${svc.price.toFixed(2)}  ·  {svc.duration} min  ·  {svc.category}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Auto-sum preview */}
        {selectedIds.size > 0 && (
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Combined price ({selectedIds.size} service{selectedIds.size !== 1 ? 's' : ''})</Text>
            <Text style={s.sumValue}>${autoSum.toFixed(2)}</Text>
          </View>
        )}

        {/* Override price */}
        <Text style={s.label}>Override Price (optional)</Text>
        <TextInput
          style={s.input}
          value={overridePrice}
          onChangeText={setOverridePrice}
          placeholder={`Leave blank to use auto-sum ($${autoSum.toFixed(2)})`}
          keyboardType="decimal-pad"
        />

        {/* Active toggle */}
        <View style={s.switchRow}>
          <Text style={s.label}>Active (visible to customers)</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: '#6a0dad', false: '#ccc' }} thumbColor="#fff" />
        </View>

        {/* Save */}
        <Pressable style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>{mode === 'add' ? 'Create Package' : 'Save Changes'}</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7fb' },
  content:   { padding: 20, paddingBottom: 48 },
  label:     { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 14 },
  hint:      { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  input:     { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f1f1f' },
  multiline: { minHeight: 72, paddingTop: 10 },

  checklist:    { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8e8e8', overflow: 'hidden' },
  checkRow:     { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  checkRowActive: { backgroundColor: '#fdf8ff' },
  checkBody:    { flex: 1, marginLeft: 10 },
  checkName:    { fontSize: 14, color: '#333' },
  checkNameActive: { color: '#6a0dad', fontWeight: '600' },
  checkMeta:    { fontSize: 12, color: '#aaa', marginTop: 1 },

  sumRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3eafd', borderRadius: 10, padding: 12, marginTop: 10 },
  sumLabel: { fontSize: 13, color: '#6a0dad' },
  sumValue: { fontSize: 16, fontWeight: '700', color: '#6a0dad' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  saveBtn:   { backgroundColor: '#6a0dad', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
