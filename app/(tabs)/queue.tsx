// app/(tabs)/queue.tsx — Walk-in Queue Display & Admin Control Screen
//
// Two modes toggled by the TV button (top-right):
//   • Staff Mode  — admin controls visible (Call Next FAB, per-entry action chips)
//   • Display Mode — clean read-only view for TV / monitor
//
// Auto-refreshes every 20 seconds; animated countdown ring shows time to next refresh.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { Colors } from '@/constants/Colors';

// ── Types ─────────────────────────────────────────────────────────────────────

type QStatus =
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'skipped'
  | 'cancelled';

interface QueueEntry {
  _id:             string;
  queueNumber:     number;
  customerName:    string;
  phoneNumber?:    string;
  serviceLabel:    string;
  price:           number;
  durationMinutes: number;
  paymentMethod:   string;
  status:          QStatus;
  position:        number | null;
  estimatedWait:   number | null;
  joinedAt:        string;
  calledAt?:       string;
  serviceStartAt?: string;
  completedAt?:    string;
  notes?:          string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 20; // seconds

const STATUS_CONFIG: Record<QStatus, { label: string; bg: string; text: string; dot: string }> = {
  waiting:    { label: 'Waiting',     bg: Colors.accentMuted, text: Colors.accent, dot: Colors.accent },
  called:     { label: 'Called',      bg: Colors.warningBg, text: Colors.warning, dot: Colors.warning },
  in_service: { label: 'In Service',  bg: Colors.successBg, text: Colors.success, dot: Colors.success },
  completed:  { label: 'Completed',   bg: Colors.surfaceAlt, text: Colors.textSecondary, dot: Colors.textMuted },
  skipped:    { label: 'Skipped',     bg: Colors.errorBg, text: Colors.error, dot: Colors.error },
  cancelled:  { label: 'Cancelled',   bg: Colors.errorBg, text: Colors.error, dot: Colors.error },
};

const PAYMENT_ICONS: Record<string, string> = {
  cash:    'cash-outline',
  counter: 'card-outline',
  wipay:   'phone-portrait-outline',
  bimpay:  'phone-portrait-outline',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtWait(minutes: number): string {
  if (minutes < 1)  return 'Now';
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: QStatus }) {
  const { label, bg, text, dot } = STATUS_CONFIG[status];
  return (
    <View style={[qd.badge, { backgroundColor: bg }]}>
      <View style={[qd.badgeDot, { backgroundColor: dot }]} />
      <Text style={[qd.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

// ── Action chip ───────────────────────────────────────────────────────────────

function ActionChip({
  label, color, icon, onPress, disabled,
}: {
  label: string; color: string; icon: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        qd.chip,
        { borderColor: color, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[qd.chipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ── Queue card ────────────────────────────────────────────────────────────────

function QueueCard({
  entry,
  isAdmin,
  tvMode,
  onAction,
}: {
  entry:    QueueEntry;
  isAdmin:  boolean;
  tvMode:   boolean;
  onAction: (id: string, status: QStatus) => void;
}) {
  const active = entry.position != null;

  return (
    <View style={[qd.card, !active && qd.cardDim]}>
      {/* Top row */}
      <View style={qd.cardTop}>
        <View style={qd.numCircle}>
          <Text style={qd.numText}>#{entry.queueNumber}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={qd.name} numberOfLines={1}>{entry.customerName}</Text>
          <Text style={qd.service} numberOfLines={1}>{entry.serviceLabel}</Text>
        </View>

        <StatusBadge status={entry.status} />
      </View>

      {/* Info row */}
      <View style={qd.infoRow}>
        {active && entry.position != null && (
          <View style={qd.infoPill}>
            <Ionicons name="people-outline" size={11} color={Colors.accent} />
            <Text style={qd.infoPillText}>Pos {entry.position}</Text>
          </View>
        )}
        {active && entry.estimatedWait != null && (
          <View style={qd.infoPill}>
            <Ionicons name="time-outline" size={11} color={Colors.accent} />
            <Text style={qd.infoPillText}>{fmtWait(entry.estimatedWait)}</Text>
          </View>
        )}
        <View style={qd.infoPill}>
          <Ionicons name={(PAYMENT_ICONS[entry.paymentMethod] ?? 'card-outline') as any} size={11} color={Colors.textMuted} />
          <Text style={[qd.infoPillText, { color: Colors.textMuted }]}>{entry.paymentMethod}</Text>
        </View>
        <View style={qd.infoPill}>
          <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
          <Text style={[qd.infoPillText, { color: Colors.textMuted }]}>{fmtTime(entry.joinedAt)}</Text>
        </View>
        <Text style={qd.price}>${entry.price.toFixed(2)}</Text>
      </View>

      {/* Admin action chips */}
      {isAdmin && !tvMode && (
        <View style={qd.chipRow}>
          {entry.status === 'waiting' && (
            <>
              <ActionChip label="Call"   color={Colors.warning} icon="megaphone-outline"
                onPress={() => onAction(entry._id, 'called')} />
              <ActionChip label="Skip"   color={Colors.error} icon="arrow-forward-outline"
                onPress={() => onAction(entry._id, 'skipped')} />
            </>
          )}
          {entry.status === 'called' && (
            <>
              <ActionChip label="Start"    color={Colors.success} icon="play-outline"
                onPress={() => onAction(entry._id, 'in_service')} />
              <ActionChip label="Re-queue" color={Colors.accent} icon="refresh-outline"
                onPress={() => onAction(entry._id, 'waiting')} />
              <ActionChip label="Skip"     color={Colors.error} icon="arrow-forward-outline"
                onPress={() => onAction(entry._id, 'skipped')} />
            </>
          )}
          {entry.status === 'in_service' && (
            <ActionChip label="Complete" color={Colors.success} icon="checkmark-circle-outline"
              onPress={() => onAction(entry._id, 'completed')} />
          )}
          {(entry.status === 'waiting' || entry.status === 'called' || entry.status === 'in_service') && (
            <ActionChip label="Cancel" color={Colors.error} icon="close-circle-outline"
              onPress={() => onAction(entry._id, 'cancelled')} />
          )}
        </View>
      )}
    </View>
  );
}

// ── Countdown ring ────────────────────────────────────────────────────────────

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const pct = seconds / total;
  return (
    <View style={qd.ringWrap}>
      <View style={[qd.ringTrack]}>
        <View
          style={[
            qd.ringFill,
            {
              width: `${Math.round(pct * 100)}%`,
              backgroundColor: pct > 0.3 ? Colors.accent : Colors.warning,
            },
          ]}
        />
      </View>
      <Text style={qd.ringText}>{seconds}s</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function QueueScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [entries,    setEntries]    = useState<QueueEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tvMode,     setTvMode]     = useState(false);
  const [countdown,  setCountdown]  = useState(REFRESH_INTERVAL);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<QueueEntry[]>('/api/queue');
      setEntries(data);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Auto-refresh + countdown ────────────────────────────────────────────────

  const resetCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchQueue(true);
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
  }, [fetchQueue]);

  useEffect(() => {
    fetchQueue();
    resetCountdown();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [fetchQueue, resetCountdown]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchQueue(true);
    resetCountdown();
  }, [fetchQueue, resetCountdown]);

  // ── Status action ───────────────────────────────────────────────────────────

  const handleAction = useCallback(async (id: string, status: QStatus) => {
    try {
      await axios.patch(`/api/queue/${id}/status`, { status });
      // Optimistic update
      setEntries(prev => prev.map(e => {
        if (e._id !== id) return e;
        return { ...e, status };
      }));
      // Full refresh to recompute positions
      fetchQueue(true);
    } catch (err: any) {
      console.warn('[Queue] action error:', err.message);
    }
  }, [fetchQueue]);

  // ── Call next ───────────────────────────────────────────────────────────────

  const callNext = useCallback(async () => {
    try {
      await axios.post('/api/queue/call-next');
      fetchQueue(true);
      resetCountdown();
    } catch (err: any) {
      console.warn('[Queue] call-next error:', err.message);
    }
  }, [fetchQueue, resetCountdown]);

  // ── Derived stats ────────────────────────────────────────────────────────────

  const waiting    = entries.filter(e => e.status === 'waiting').length;
  const inService  = entries.filter(e => e.status === 'in_service').length;
  const called     = entries.filter(e => e.status === 'called').length;
  const done       = entries.filter(e => e.status === 'completed').length;

  // Visible entries (hide cancelled/skipped in TV mode for cleanliness)
  const visible = tvMode
    ? entries.filter(e => !['cancelled', 'skipped'].includes(e.status))
    : entries;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={qd.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={qd.header}>
        <Pressable onPress={() => router.back()} style={qd.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={qd.title}>Walk-in Queue</Text>
          <Text style={qd.sub}>Today's queue</Text>
        </View>

        <CountdownRing seconds={countdown} total={REFRESH_INTERVAL} />

        {/* TV mode toggle */}
        <Pressable
          onPress={() => setTvMode(v => !v)}
          style={[qd.tvBtn, tvMode && qd.tvBtnActive]}
          hitSlop={8}
        >
          <Ionicons name="tv-outline" size={17} color={tvMode ? Colors.white : Colors.accent} />
        </Pressable>

        {/* Walkin kiosk shortcut */}
        <Pressable
          onPress={() => router.push('/(tabs)/walkin')}
          style={qd.walkinBtn}
          hitSlop={8}
        >
          <Ionicons name="add-circle-outline" size={17} color={Colors.accent} />
          <Text style={qd.walkinBtnText}>Walk-in</Text>
        </Pressable>
      </View>

      {/* ── Stats strip ── */}
      <View style={qd.statsRow}>
        <View style={[qd.statCard, { borderLeftColor: Colors.accent }]}>
          <Text style={[qd.statNum, { color: Colors.accent }]}>{waiting}</Text>
          <Text style={qd.statLabel}>Waiting</Text>
        </View>
        <View style={[qd.statCard, { borderLeftColor: Colors.warning }]}>
          <Text style={[qd.statNum, { color: Colors.warning }]}>{called}</Text>
          <Text style={qd.statLabel}>Called</Text>
        </View>
        <View style={[qd.statCard, { borderLeftColor: Colors.success }]}>
          <Text style={[qd.statNum, { color: Colors.success }]}>{inService}</Text>
          <Text style={qd.statLabel}>In Service</Text>
        </View>
        <View style={[qd.statCard, { borderLeftColor: Colors.textMuted }]}>
          <Text style={[qd.statNum, { color: Colors.textMuted }]}>{done}</Text>
          <Text style={qd.statLabel}>Done</Text>
        </View>
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={qd.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={e => e._id}
          contentContainerStyle={qd.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={qd.empty}>
              <Ionicons name="people-outline" size={52} color={Colors.border} />
              <Text style={qd.emptyTitle}>Queue is empty</Text>
              <Text style={qd.emptyText}>No walk-ins today yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <QueueCard
              entry={item}
              isAdmin={isAdmin}
              tvMode={tvMode}
              onAction={handleAction}
            />
          )}
        />
      )}

      {/* ── Call Next FAB (admin, non-TV) ── */}
      {isAdmin && !tvMode && waiting > 0 && (
        <Pressable
          style={({ pressed }) => [qd.fab, pressed && { opacity: 0.85 }]}
          onPress={callNext}
        >
          <Ionicons name="megaphone-outline" size={20} color={Colors.white} />
          <Text style={qd.fabText}>Call Next</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const qd = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14,
  },
  backBtn:  { padding: 4 },
  title:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  sub:      { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  tvBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  tvBtnActive: { backgroundColor: Colors.accent },
  walkinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accentMuted, borderRadius: 99,
    paddingHorizontal: 11, paddingVertical: 6, marginLeft: 8,
  },
  walkinBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  // Countdown ring (actually a progress bar)
  ringWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8,
  },
  ringTrack: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, overflow: 'hidden',
  },
  ringFill:  { height: 4, borderRadius: 2 },
  ringText:  { fontSize: 10, color: Colors.textMuted, fontWeight: '600', minWidth: 22 },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginBottom: 14,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 10,
    borderLeftWidth: 3, ...SHADOW,
  },
  statNum:   { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  // Card
  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 14, marginBottom: 10, ...SHADOW,
  },
  cardDim: { opacity: 0.65 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  numCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center',
  },
  numText:  { fontSize: 13, fontWeight: '800', color: Colors.accent },
  name:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  service:  { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  price:    { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginLeft: 'auto' },

  // Badge
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText:{ fontSize: 11, fontWeight: '700' },

  // Info pills
  infoRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 6, marginBottom: 8,
  },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.surfaceAlt, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3,
  },
  infoPillText: { fontSize: 11, color: Colors.accent, fontWeight: '600' },

  // Action chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 11, fontWeight: '700' },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 99,
    paddingHorizontal: 24, paddingVertical: 14,
    ...Platform.select({
      ios:     { shadowColor: Colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  fabText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 6 },
  emptyText:  { fontSize: 14, color: Colors.textMuted },
});
