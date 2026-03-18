// app/(tabs)/walkin.tsx — Walk-in Queue Management
// Staff/admin view of the live walk-in queue.
// Polls GET /api/queue every 15 s.
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  _id: string;
  name: string;
  duration: number; // minutes
}

interface QueueEntry {
  _id: string;
  position: number;
  customerName: string;
  phoneNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  serviceName: string;
  serviceId: string;
  joinedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 15_000;
const FALLBACK_AVG_MINUTES = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone?: string): string {
  if (!phone || phone.length < 4) return phone ?? '';
  return '•••• ' + phone.slice(-4);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── PulseDot ─────────────────────────────────────────────────────────────────

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={w.pulseDotWrap}>
      <Animated.View style={[w.pulseDotOuter, { transform: [{ scale }] }]} />
      <View style={w.pulseDotInner} />
    </View>
  );
}

// ─── QueueCard ────────────────────────────────────────────────────────────────

function QueueCard({
  entry,
  avgMinutes,
  onCallNext,
  onRemove,
  callNextBusy,
}: {
  entry: QueueEntry;
  avgMinutes: number;
  onCallNext: () => void;
  onRemove: () => void;
  callNextBusy: boolean;
}) {
  const waitMins = Math.max(0, entry.position - 1) * avgMinutes;
  const isNext   = entry.position === 1;

  return (
    <View style={w.card}>
      {/* Top row: position badge + name/phone + joined time */}
      <View style={w.cardTop}>
        <View style={w.posBadge}>
          <Text style={w.posText}>{entry.position}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={w.customerName}>{entry.customerName}</Text>
          {!!entry.phoneNumber && (
            <Text style={w.phoneText}>{maskPhone(entry.phoneNumber)}</Text>
          )}
        </View>
        <Text style={w.joinedTime}>{formatTime(entry.joinedAt)}</Text>
      </View>

      {/* Detail chips */}
      <View style={w.chipsRow}>
        {(entry.vehicleMake || entry.vehicleModel) && (
          <View style={w.chip}>
            <Ionicons name="car-outline" size={11} color={Colors.textMuted} />
            <Text style={w.chipText}>
              {[entry.vehicleMake, entry.vehicleModel].filter(Boolean).join(' ')}
            </Text>
          </View>
        )}
        <View style={[w.chip, { backgroundColor: Colors.accentMuted }]}>
          <Ionicons name="layers-outline" size={11} color={Colors.accent} />
          <Text style={[w.chipText, { color: Colors.accent }]}>{entry.serviceName}</Text>
        </View>
        {waitMins > 0 ? (
          <View style={w.chip}>
            <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
            <Text style={w.chipText}>~{waitMins} min wait</Text>
          </View>
        ) : (
          <View style={[w.chip, { backgroundColor: Colors.successBg }]}>
            <Ionicons name="checkmark-circle-outline" size={11} color={Colors.success} />
            <Text style={[w.chipText, { color: Colors.success }]}>Ready now</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={w.cardActions}>
        {isNext && (
          <Pressable
            style={[w.callNextBtn, callNextBusy && { opacity: 0.6 }]}
            onPress={onCallNext}
            disabled={callNextBusy}
          >
            {callNextBusy ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="megaphone-outline" size={16} color={Colors.white} />
                <Text style={w.callNextText}>Call Next</Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable
          style={[w.removeBtn, isNext && { flex: 0, paddingHorizontal: 16 }]}
          onPress={onRemove}
        >
          <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
          {!isNext && <Text style={w.removeBtnText}>Remove</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ─── AddWalkInSheet ───────────────────────────────────────────────────────────

function AddWalkInSheet({
  visible,
  services,
  onClose,
  onAdded,
}: {
  visible: boolean;
  services: Service[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const insets    = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const [name,          setName]          = useState('');
  const [phone,         setPhone]         = useState('');
  const [vehicleMake,   setVehicleMake]   = useState('');
  const [vehicleModel,  setVehicleModel]  = useState('');
  const [selectedSvc,   setSelectedSvc]   = useState<Service | null>(null);
  const [submitting,    setSubmitting]    = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue:         visible ? 0 : 700,
        useNativeDriver: true,
        bounciness:      3,
      }),
      Animated.timing(bgOpacity, {
        toValue:         visible ? 1 : 0,
        duration:        250,
        useNativeDriver: true,
      }),
    ]).start();

    if (!visible) {
      setName(''); setPhone(''); setVehicleMake('');
      setVehicleModel(''); setSelectedSvc(null);
    }
  }, [visible]);

  const handleAdd = async () => {
    if (!name.trim() || !selectedSvc) return;
    setSubmitting(true);
    try {
      await axios.post('/api/queue', {
        customerName:  name.trim(),
        phoneNumber:   phone.trim() || undefined,
        vehicleMake:   vehicleMake.trim() || undefined,
        vehicleModel:  vehicleModel.trim() || undefined,
        serviceId:     selectedSvc._id,
        serviceName:   selectedSvc.name,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAdded();
      onClose();
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.response?.data?.error ?? 'Could not add to queue.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = name.trim().length > 0 && selectedSvc !== null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[w.backdrop, { opacity: bgOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          w.sheet,
          { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {/* Handle + header */}
        <View style={w.sheetHandle} />
        <View style={w.sheetHeader}>
          <Text style={w.sheetTitle}>Add Walk-in</Text>
          <Pressable style={w.sheetCloseBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={w.sheetContent}
          >
            {/* Customer Name */}
            <Text style={w.label}>Customer Name *</Text>
            <TextInput
              style={w.input}
              placeholder="e.g. John Smith"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            {/* Phone */}
            <Text style={w.label}>Phone Number</Text>
            <TextInput
              style={w.input}
              placeholder="Optional"
              placeholderTextColor={Colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            {/* Vehicle */}
            <Text style={w.label}>Vehicle Make / Model</Text>
            <View style={w.inputRow}>
              <TextInput
                style={[w.input, { flex: 1 }]}
                placeholder="Make"
                placeholderTextColor={Colors.textMuted}
                value={vehicleMake}
                onChangeText={setVehicleMake}
                autoCapitalize="words"
              />
              <TextInput
                style={[w.input, { flex: 1 }]}
                placeholder="Model"
                placeholderTextColor={Colors.textMuted}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                autoCapitalize="words"
              />
            </View>

            {/* Service picker */}
            <Text style={w.label}>Service *</Text>
            <View style={w.svcGrid}>
              {services.length === 0 ? (
                <Text style={w.noSvcText}>No services available</Text>
              ) : (
                services.map(svc => {
                  const sel = selectedSvc?._id === svc._id;
                  return (
                    <Pressable
                      key={svc._id}
                      style={[w.svcChip, sel && w.svcChipSel]}
                      onPress={() => setSelectedSvc(svc)}
                    >
                      <Text style={[w.svcChipText, sel && { color: Colors.accent }]}>
                        {svc.name}
                      </Text>
                      {sel && (
                        <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* Submit */}
            <Pressable
              style={[w.addBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
              onPress={handleAdd}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={18} color={Colors.white} />
                  <Text style={w.addBtnText}>Add to Queue</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WalkinQueueScreen() {
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();

  const [queue,         setQueue]         = useState<QueueEntry[]>([]);
  const [services,      setServices]      = useState<Service[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [callNextBusy,  setCallNextBusy]  = useState(false);
  const [sheetVisible,  setSheetVisible]  = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch queue
  const fetchQueue = useCallback(async () => {
    try {
      const { data } = await axios.get<QueueEntry[]>('/api/queue');
      setQueue(data);
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch services (once)
  useEffect(() => {
    axios.get<Service[]>('/api/services').then(r => setServices(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchQueue();
    intervalRef.current = setInterval(fetchQueue, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchQueue]);

  // Call Next
  const handleCallNext = useCallback(async () => {
    setCallNextBusy(true);
    try {
      await axios.patch('/api/queue/next');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchQueue();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Could not call next customer.');
    } finally {
      setCallNextBusy(false);
    }
  }, [fetchQueue]);

  // Remove entry
  const handleRemove = useCallback((entry: QueueEntry) => {
    Alert.alert(
      'Remove from Queue',
      `Remove ${entry.customerName} from the queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/api/queue/${entry._id}`);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchQueue();
            } catch {
              Alert.alert('Error', 'Could not remove from queue.');
            }
          },
        },
      ],
    );
  }, [fetchQueue]);

  const avgMinutes = services.length > 0
    ? Math.round(services.reduce((s, sv) => s + sv.duration, 0) / services.length)
    : FALLBACK_AVG_MINUTES;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>

      {/* ── Floating back button ── */}
      <Pressable
        style={[w.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </Pressable>

      {/* ── Header ── */}
      <View style={[w.header, { paddingTop: insets.top + 12 }]}>
        <View style={w.headerLeft}>
          <Text style={w.headerTitle}>Walk-in Queue</Text>
          <View style={w.liveRow}>
            <PulseDot />
            <Text style={w.liveText}>Live</Text>
          </View>
        </View>
        <View style={w.queueCountBadge}>
          <Text style={w.queueCountText}>{queue.length} in queue</Text>
        </View>
      </View>

      {/* ── Queue list ── */}
      {loading ? (
        <View style={w.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : queue.length === 0 ? (
        <View style={w.centered}>
          <View style={w.emptyIconWrap}>
            <Ionicons name="checkmark-circle-outline" size={52} color={Colors.success} />
          </View>
          <Text style={w.emptyTitle}>Queue is empty ✓</Text>
          <Text style={w.emptyText}>Customers will appear here when they join</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[w.listContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {queue.map(entry => (
            <QueueCard
              key={entry._id}
              entry={entry}
              avgMinutes={avgMinutes}
              onCallNext={handleCallNext}
              onRemove={() => handleRemove(entry)}
              callNextBusy={callNextBusy}
            />
          ))}
        </ScrollView>
      )}

      {/* ── FAB ── */}
      <Pressable
        style={[w.fab, { bottom: insets.bottom + 30 }]}
        onPress={() => setSheetVisible(true)}
      >
        <Ionicons name="add" size={30} color={Colors.white} />
      </Pressable>

      {/* ── Add walk-in bottom sheet ── */}
      <AddWalkInSheet
        visible={sheetVisible}
        services={services}
        onClose={() => setSheetVisible(false)}
        onAdded={fetchQueue}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const w = StyleSheet.create({
  // Layout helpers
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: SCREEN_PADDING,
  },

  // Floating back button
  backBtn: {
    position: 'absolute', left: 16, zIndex: 100,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...cardShadow,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingLeft: 64, // space for back button
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  pulseDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseDotOuter: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.success + '40',
  },
  pulseDotInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveText: { fontSize: 13, fontWeight: '700', color: Colors.success },
  queueCountBadge: {
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  queueCountText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // List
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingTop: 12 },

  // Queue card
  card: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  posBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.accent,
  },
  posText:      { fontSize: 18, fontWeight: '900', color: Colors.accent },
  customerName: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  phoneText:    { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  joinedTime:   { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  cardActions: { flexDirection: 'row', gap: 10 },
  callNextBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
  },
  callNextText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  removeBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.errorBg,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
  },
  removeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.error },

  // FAB
  fab: {
    position: 'absolute', right: 20, zIndex: 50,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },

  // Empty state
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.successBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },

  // Bottom sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,22,40,0.5)',
    zIndex: 98,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 99,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    maxHeight: '88%',
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
    }),
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetContent: { paddingTop: 8, paddingBottom: 16 },

  // Form fields
  label: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    marginTop: 16, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputRow: { flexDirection: 'row', gap: 10 },

  // Service picker
  svcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  svcChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  svcChipSel: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accent,
  },
  svcChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  noSvcText:   { fontSize: 13, color: Colors.textMuted },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    marginTop: 24,
  },
  addBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
