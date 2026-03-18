import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

const CATEGORIES = ['Soap', 'Wax', 'Cloths', 'Equipment', 'Other'];
const UNITS = ['units', 'liters', 'gallons', 'kg', 'lbs', 'bottles', 'bags', 'rolls', 'boxes'];

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  lowStockThreshold: number;
  notes?: string;
}

// ── Picker Modal ──────────────────────────────────────────────────────────────
function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerOption, item === selected && styles.pickerOptionSelected]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[styles.pickerOptionText, item === selected && styles.pickerOptionTextSelected]}>
                  {item}
                </Text>
                {item === selected && (
                  <Ionicons name="checkmark" size={20} color={Colors.accent} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function InventoryEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Soap');
  const [currentStock, setCurrentStock] = useState('');
  const [unit, setUnit] = useState('units');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [notes, setNotes] = useState('');

  // Picker visibility
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // Load existing item in edit mode
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inventory/${id}`);
        if (!res.ok) throw new Error('Failed to load item');
        const item: InventoryItem = await res.json();
        if (cancelled) return;
        setName(item.name);
        setCategory(item.category);
        setCurrentStock(String(item.currentStock));
        setUnit(item.unit);
        setLowStockThreshold(String(item.lowStockThreshold));
        setNotes(item.notes ?? '');
      } catch {
        if (!cancelled) {
          Alert.alert('Error', 'Could not load item.', [{ text: 'OK', onPress: () => router.back() }]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const validate = useCallback(() => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required.'); return false; }
    const stock = Number(currentStock);
    if (isNaN(stock) || stock < 0) { Alert.alert('Validation', 'Current stock must be a non-negative number.'); return false; }
    const threshold = Number(lowStockThreshold);
    if (isNaN(threshold) || threshold < 0) { Alert.alert('Validation', 'Low stock threshold must be a non-negative number.'); return false; }
    return true;
  }, [name, currentStock, lowStockThreshold]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        category,
        currentStock: Number(currentStock),
        unit,
        lowStockThreshold: Number(lowStockThreshold),
        notes: notes.trim(),
      };
      const res = await fetch(
        isEdit ? `/api/inventory/${id}` : '/api/inventory',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('Save failed');
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save item. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [validate, name, category, currentStock, unit, lowStockThreshold, notes, id, isEdit]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
              if (!res.ok) throw new Error('Delete failed');
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete item. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [name, id]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Edit Item',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.accent,
            headerTitleStyle: { color: Colors.textPrimary, fontWeight: '600' },
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isEdit ? 'Edit Item' : 'Add Item',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.accent,
          headerTitleStyle: { color: Colors.textPrimary, fontWeight: '600' },
          headerBackTitle: 'Inventory',
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Name ── */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Premium Car Shampoo"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="next"
              autoCapitalize="words"
            />
          </View>

          {/* ── Category ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
              <Text style={styles.pickerButtonText}>{category}</Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Stock + Unit ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Current Stock</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 10 }]}
                value={currentStock}
                onChangeText={setCurrentStock}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                returnKeyType="next"
              />
              <TouchableOpacity
                style={[styles.pickerButton, { width: 120 }]}
                onPress={() => setShowUnitPicker(true)}
              >
                <Text style={styles.pickerButtonText}>{unit}</Text>
                <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Low Stock Threshold ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Low Stock Alert Threshold</Text>
            <TextInput
              style={styles.input}
              value={lowStockThreshold}
              onChangeText={setLowStockThreshold}
              placeholder="e.g. 5"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              returnKeyType="next"
            />
            <Text style={styles.hint}>Alert shows when stock is at or below this number.</Text>
          </View>

          {/* ── Notes ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Supplier info, storage instructions, etc."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="default"
            />
          </View>

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[styles.saveButton, (saving || deleting) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving || deleting}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name={isEdit ? 'checkmark-circle' : 'add-circle'} size={20} color="#fff" />
                <Text style={styles.saveButtonText}>{isEdit ? 'Update Item' : 'Add Item'}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Delete Button (edit mode only) ── */}
          {isEdit && (
            <TouchableOpacity
              style={[styles.deleteButton, (saving || deleting) && styles.buttonDisabled]}
              onPress={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  <Text style={styles.deleteButtonText}>Delete Item</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Pickers ── */}
      <PickerModal
        visible={showCategoryPicker}
        title="Select Category"
        options={CATEGORIES}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
      />
      <PickerModal
        visible={showUnitPicker}
        title="Select Unit"
        options={UNITS}
        selected={unit}
        onSelect={setUnit}
        onClose={() => setShowUnitPicker(false)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: SCREEN_PADDING,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: Colors.error,
    marginBottom: 8,
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,22,40,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: Colors.accentMuted,
  },
  pickerOptionText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  pickerOptionTextSelected: {
    fontWeight: '600',
    color: Colors.accent,
  },
});
