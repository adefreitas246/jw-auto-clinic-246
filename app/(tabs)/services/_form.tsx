// app/(tabs)/services/_form.tsx — shared add/edit form for admin service management
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

import { Service } from '@/types/catalog';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Text style={s.sectionLabel}>Service Details</Text>
        <View style={s.card}>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Name <Text style={s.required}>*</Text></Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Full Detail Wash"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={s.divider} />

          {/* Price + Duration row */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Price ($) <Text style={s.required}>*</Text></Text>
              <TextInput
                style={s.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.rowGap} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Duration (min) <Text style={s.required}>*</Text></Text>
              <TextInput
                style={s.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="30"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* Category */}
        <Text style={s.sectionLabel}>Category</Text>
        <View style={s.pills}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              style={[s.pill, category === cat && s.pillActive]}
              onPress={() => setCategory(cat)}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Text style={[s.pillText, category === cat && s.pillTextActive]}>{cat}</Text>
            </Pressable>
          ))}
        </View>

        {/* Description */}
        <Text style={s.sectionLabel}>Description</Text>
        <View style={s.card}>
          <TextInput
            style={[s.input, s.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional details shown to customers…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
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

        {/* Save button */}
        <Pressable
          style={({ pressed }) => [s.saveBtn, saving && s.saveBtnBusy, pressed && { opacity: 0.88 }]}
          onPress={handleSave}
          disabled={saving}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={s.saveBtnText}>{mode === 'add' ? 'Add Service' : 'Save Changes'}</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceAlt },
  content:   { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...cardShadow,
    marginBottom: 4,
  },
  switchCard:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginBottom: 4 },
  switchBody:  { flex: 1 },
  switchTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  switchSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  fieldWrap: { paddingVertical: 12 },
  divider:   { height: 1, backgroundColor: Colors.border },
  row:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  rowGap:    { width: 12 },

  label:    { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  required: { color: Colors.error },
  input:    {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt,
  },
  multiline: { minHeight: 80, paddingTop: 10 },

  pills:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, ...cardShadow },
  pillActive:     { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pillText:       { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  pillTextActive: { color: Colors.white, fontWeight: '700' },

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
