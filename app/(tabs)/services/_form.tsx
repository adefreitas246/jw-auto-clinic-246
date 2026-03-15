// app/(tabs)/services/_form.tsx — shared add/edit form for admin service management
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

import { Service } from '@/types/catalog';
import { Colors } from '@/constants/Colors';

const CATEGORIES = ['General', 'Exterior', 'Interior', 'Detail', 'Premium', 'Other'];

interface Props { mode: 'add' | 'edit' }

export default function ServiceFormScreen({ mode }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name,        setName]        = useState('');
  const [price,       setPrice]       = useState('');
  const [duration,    setDuration]    = useState('30');
  const [category,    setCategory]    = useState('General');
  const [description, setDescription] = useState('');
  const [active,      setActive]      = useState(true);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    axios.get<Service[]>('/api/services').then(res => {
      const svc = res.data.find(s => s._id === id);
      if (!svc) return;
      setName(svc.name);
      setPrice(String(svc.price));
      setDuration(String(svc.duration));
      setCategory(svc.category);
      setDescription(svc.description);
      setActive(svc.active);
    }).catch(() => Alert.alert('Error', 'Could not load service.'));
  }, [mode, id]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { Alert.alert('Validation', 'Enter a valid price.'); return; }
    const durNum = parseInt(duration, 10);
    if (isNaN(durNum) || durNum < 1) { Alert.alert('Validation', 'Duration must be at least 1 minute.'); return; }

    setSaving(true);
    try {
      const payload = { name: name.trim(), price: priceNum, duration: durNum, category, description: description.trim(), active };
      if (mode === 'add') {
        await axios.post('/api/services', payload);
      } else {
        await axios.put(`/api/services/${id}`, payload);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Could not save service.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <Text style={s.label}>Name *</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Full Detail Wash" autoCapitalize="words" />

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Price ($) *</Text>
            <TextInput style={s.input} value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Duration (min) *</Text>
            <TextInput style={s.input} value={duration} onChangeText={setDuration} placeholder="30" keyboardType="number-pad" />
          </View>
        </View>

        <Text style={s.label}>Category</Text>
        <View style={s.pills}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              style={[s.pill, category === cat && s.pillActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[s.pillText, category === cat && s.pillTextActive]}>{cat}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Description</Text>
        <TextInput
          style={[s.input, s.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details shown to customers…"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <View style={s.switchRow}>
          <Text style={s.label}>Active (visible to customers)</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.white} />
        </View>

        <Pressable style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={s.saveBtnText}>{mode === 'add' ? 'Add Service' : 'Save Changes'}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7fb' },
  content:   { padding: 20, paddingBottom: 48 },
  label:     { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6, marginTop: 14 },
  input:     { backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary },
  multiline: { minHeight: 80, paddingTop: 10 },
  row:       { flexDirection: 'row', alignItems: 'flex-start' },
  pills:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  pillActive:     { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pillText:       { fontSize: 13, color: Colors.textSecondary },
  pillTextActive: { color: Colors.white, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  saveBtn:   { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
