// app/(tabs)/inventory/service-map.tsx — Service → Inventory Consumption Mapping
//
// Lets admins define how much of each inventory item a service consumes per job.
// When a job is marked finished, call POST /api/inventory/deduct-for-booking/:id
// to automatically deduct these amounts from stock.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { Colors } from '@/constants/Colors';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Service {
  _id:      string;
  name:     string;
  category: string;
  price:    number;
}

interface InventoryItem {
  _id:  string;
  name: string;
  unit: string;
  currentStock: number;
}

interface Mapping {
  _id:            string;
  serviceId?:     { _id: string; name: string; category: string } | null;
  packageId?:     { _id: string; name: string } | null;
  inventoryItemId:{ _id: string; name: string; unit: string; currentStock: number };
  amountPerUse:   number;
}

// ── Add Mapping Modal ─────────────────────────────────────────────────────────

function AddMappingModal({
  visible,
  serviceId,
  serviceName,
  inventoryItems,
  onSave,
  onClose,
}: {
  visible:        boolean;
  serviceId:      string;
  serviceName:    string;
  inventoryItems: InventoryItem[];
  onSave:         (itemId: string, amount: number) => Promise<void>;
  onClose:        () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [amount,       setAmount]       = useState('1');
  const [saving,       setSaving]       = useState(false);
  const [step,         setStep]         = useState<'pick' | 'amount'>('pick');

  const reset = () => { setSelectedItem(null); setAmount('1'); setStep('pick'); };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!selectedItem) return;
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Amount must be > 0.');
      return;
    }
    setSaving(true);
    try {
      await onSave(selectedItem._id, amt);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={am.overlay} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={am.sheet}
      >
        <View style={am.handle} />
        <Text style={am.title}>
          {step === 'pick' ? `Add material for "${serviceName}"` : `How much ${selectedItem?.unit} per job?`}
        </Text>

        {step === 'pick' ? (
          <FlatList
            data={inventoryItems}
            keyExtractor={it => it._id}
            style={{ maxHeight: 300 }}
            renderItem={({ item }) => (
              <Pressable
                style={am.optionRow}
                onPress={() => { setSelectedItem(item); setStep('amount'); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={am.optName}>{item.name}</Text>
                  <Text style={am.optSub}>{item.currentStock} {item.unit} in stock</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} />
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={am.empty}>No inventory items found. Add items first.</Text>
            }
          />
        ) : (
          <View style={am.amountSection}>
            <Text style={am.amountLabel}>
              {selectedItem?.name} per job ({selectedItem?.unit})
            </Text>
            <TextInput
              style={am.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 50"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            <View style={am.btnRow}>
              <Pressable style={am.cancelBtn} onPress={() => setStep('pick')}>
                <Text style={am.cancelBtnText}>Back</Text>
              </Pressable>
              <Pressable
                style={[am.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={am.saveBtnText}>Add Mapping</Text>
                }
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginVertical: 12,
  },
  title:      { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  optionRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.surfaceAlt },
  optName:    { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  optSub:     { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  empty:      { textAlign: 'center', color: Colors.textMuted, paddingVertical: 20 },
  amountSection: { paddingVertical: 8 },
  amountLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 10 },
  amountInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 22,
    fontWeight: '700', color: Colors.textPrimary, marginBottom: 16, textAlign: 'center',
  },
  btnRow:      { flexDirection: 'row', gap: 12 },
  cancelBtn:   { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', paddingVertical: 12 },
  cancelBtnText:{ fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  saveBtn:     { flex: 2, backgroundColor: Colors.accent, borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ServiceMapScreen() {
  const [services,  setServices]  = useState<Service[]>([]);
  const [items,     setItems]     = useState<InventoryItem[]>([]);
  const [mappings,  setMappings]  = useState<Mapping[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalSvc,  setModalSvc]  = useState<Service | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svcRes, invRes, mapRes] = await Promise.all([
        axios.get<Service[]>('/api/services'),
        axios.get<InventoryItem[]>('/api/inventory'),
        axios.get<Mapping[]>('/api/inventory/service-map'),
      ]);
      setServices(svcRes.data.filter(s => (s as any).active !== false));
      setItems(invRes.data);
      setMappings(mapRes.data);
    } catch {
      Alert.alert('Error', 'Failed to load data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Mappings for a specific service
  const mappingsForService = (svcId: string) =>
    mappings.filter(m => m.serviceId?._id === svcId || (m.serviceId as any) === svcId);

  const handleAddMapping = async (svcId: string, itemId: string, amount: number) => {
    const { data } = await axios.post<Mapping>('/api/inventory/service-map', {
      serviceId:       svcId,
      inventoryItemId: itemId,
      amountPerUse:    amount,
    });
    setMappings(prev => {
      // Replace if exists, else append
      const idx = prev.findIndex(m => m._id === data._id);
      return idx >= 0 ? prev.map((m, i) => i === idx ? data : m) : [...prev, data];
    });
  };

  const handleDeleteMapping = (mapId: string) => {
    Alert.alert('Remove Mapping', 'Remove this inventory consumption mapping?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`/api/inventory/service-map/${mapId}`);
            setMappings(prev => prev.filter(m => m._id !== mapId));
          } catch {
            Alert.alert('Error', 'Failed to remove mapping.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={sm.safe} edges={['top']}>
        <View style={sm.centered}><ActivityIndicator size="large" color={Colors.accent} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sm.safe} edges={['top']}>
      {/* Header */}
      <View style={sm.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={sm.title}>Service Mappings</Text>
          <Text style={sm.sub}>Define inventory consumed per service</Text>
        </View>
        <Pressable onPress={load} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={Colors.accent} />
        </Pressable>
      </View>

      {/* Info box */}
      <View style={sm.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
        <Text style={sm.infoText}>
          After marking a job finished, call{' '}
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
            POST /api/inventory/deduct-for-booking/:id
          </Text>{' '}
          to auto-deduct stock.
        </Text>
      </View>

      <FlatList
        data={services}
        keyExtractor={s => s._id}
        contentContainerStyle={sm.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: svc }) => {
          const svcMappings = mappingsForService(svc._id);
          return (
            <View style={sm.card}>
              {/* Service header */}
              <View style={sm.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={sm.svcName}>{svc.name}</Text>
                  <Text style={sm.svcCat}>{svc.category} · ${svc.price}</Text>
                </View>
                <Pressable
                  style={sm.addBtn}
                  onPress={() => setModalSvc(svc)}
                >
                  <Ionicons name="add" size={16} color={Colors.accent} />
                  <Text style={sm.addBtnText}>Add</Text>
                </Pressable>
              </View>

              {/* Mapped items */}
              {svcMappings.length === 0 ? (
                <Text style={sm.noMappings}>No materials mapped — tap Add to configure.</Text>
              ) : (
                svcMappings.map(m => (
                  <View key={m._id} style={sm.mapRow}>
                    <View style={sm.mapIconWrap}>
                      <Ionicons name="cube-outline" size={14} color={Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={sm.mapItemName}>{m.inventoryItemId?.name ?? '—'}</Text>
                      <Text style={sm.mapAmount}>
                        {m.amountPerUse} {m.inventoryItemId?.unit} per job
                        {(m.inventoryItemId?.currentStock ?? 0) < m.amountPerUse * 5 && (
                          <Text style={{ color: Colors.error }}> ⚠ low</Text>
                        )}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleDeleteMapping(m._id)} hitSlop={8}>
                      <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={sm.centered}>
            <Ionicons name="construct-outline" size={48} color={Colors.border} />
            <Text style={{ fontSize: 15, color: Colors.textMuted, marginTop: 12 }}>No services found.</Text>
          </View>
        }
      />

      {/* Add Mapping modal */}
      {modalSvc && (
        <AddMappingModal
          visible
          serviceId={modalSvc._id}
          serviceName={modalSvc.name}
          inventoryItems={items}
          onSave={(itemId, amount) => handleAddMapping(modalSvc._id, itemId, amount)}
          onClose={() => setModalSvc(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const sm = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sub:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.accentMuted, marginHorizontal: 16, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  infoText: { fontSize: 12, color: Colors.accent, flex: 1, lineHeight: 17 },

  list: { paddingHorizontal: 16, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 12, ...SHADOW,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  svcName:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  svcCat:     { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, borderWidth: 1.5, borderColor: Colors.accent,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  noMappings: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', paddingLeft: 4 },

  mapRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surfaceAlt, borderRadius: 8, padding: 8, marginTop: 6,
  },
  mapIconWrap: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  mapItemName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  mapAmount:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
});
