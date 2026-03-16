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
import * as Haptics from 'expo-haptics';
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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import axios from 'axios';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

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
  waiting:    { label: 'Waiting',     bg: Colors.accentMuted,  text: Colors.accent,       dot: Colors.accent },
  called:     { label: 'Called',      bg: Colors.warningBg,    text: Colors.warning,       dot: Colors.warning },
  in_service: { label: 'In Service',  bg: Colors.successBg,    text: Colors.success,       dot: Colors.success },
  completed:  { label: 'Completed',   bg: Colors.surfaceAlt,   text: Colors.textSecondary, dot: Colors.textMuted },
  skipped:    { label: 'Skipped',     bg: Colors.errorBg,      text: Colors.error,         dot: Colors.error },
  cancelled:  { label: 'Cancelled',   bg: Colors.errorBg,      text: Colors.error,         dot: Colors.error },
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
      onPress={() => {
        if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      android_ripple={{ color: Colors.accent + '20', borderless: false }}
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
  index,
}: {
  entry:    QueueEntry;
  isAdmin:  boolean;
  tvMode:   boolean;
  onAction: (id: string, status: QStatus) => void;
  index:    number;
}) {
  const active = entry.position != null;
  const statusCfg = STATUS_CONFIG[entry.status];

  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 80).duration(300)}>
      <View style={[qd.card, !active && qd.cardDim]}>
        {/* Top row */}
        <View style={qd.cardTop}>
          {/* Number badge */}
          <View style={[qd.numCircle, { backgroundColor: Colors.accent }]}>
            <Text style={qd.numText}>{entry.queueNumber}</Text>
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={qd.name} numberOfLines={1}>{entry.customerName}</Text>
            <Text style={qd.service} numberOfLines={1}>{entry.serviceLabel}</Text>
            {entry.notes ? (
              <Text style={qd.notes} numberOfLines={1}>{entry.notes}</Text>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StatusBadge status={entry.status} />
            <Text style={qd.price}>${entry.price.toFixed(2)}</Text>
          </View>
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
            <View style={[qd.infoPill, { backgroundColor: Colors.warningBg }]}>
              <Ionicons name="time-outline" size={11} color={Colors.warning} />
              <Text style={[qd.infoPillText, { color: Colors.warning }]}>{fmtWait(entry.estimatedWait)}</Text>
            </View>
          )}
          <View style={qd.infoPillNeutral}>
            <Ionicons name={(PAYMENT_ICONS[entry.paymentMethod] ?? 'card-outline') as any} size={11} color={Colors.textMuted} />
            <Text style={qd.infoPillNeutralText}>{entry.paymentMethod}</Text>
          </View>
          <View style={qd.infoPillNeutral}>
            <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
            <Text style={qd.infoPillNeutralText}>{fmtTime(entry.joinedAt)}</Text>
          </View>
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
    </ReAnimated.View>
  );
}

// ── Pulsing dot ───────────────────────────────────────────────────────────────

function PulsingDot() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[qd.pulsingDot, { opacity: pulse }]} />
  );
}

// ── Countdown bar ─────────────────────────────────────────────────────────────

function CountdownBar({ seconds, total }: { seconds: number; total: number }) {
  const pct = seconds / total;
  return (
    <View style={qd.countdownWrap}>
      <View style={qd.countdownTrack}>
        <View
          style={[
            qd.countdownFill,
            {
              width: `${Math.round(pct * 100)}%`,
              backgroundColor: pct > 0.3 ? Colors.accent : Colors.warning,
            },
          ]}
        />
      </View>
      <Text style={qd.countdownText}>{seconds}s</Text>
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
    if (IS_IOS) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        <View style={qd.headerLeft}>
          <PulsingDot />
          <Text style={qd.title}>Live Queue</Text>
        </View>

        <View style={qd.headerRight}>
          <Text style={qd.autoRefreshLabel}>Auto-refresh</Text>
          <CountdownBar seconds={countdown} total={REFRESH_INTERVAL} />
        </View>

        {/* TV mode toggle */}
        <Pressable
          onPress={() => {
            if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTvMode(v => !v);
          }}
          style={[qd.tvBtn, tvMode && qd.tvBtnActive]}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
          hitSlop={8}
        >
          <Ionicons name="tv-outline" size={17} color={tvMode ? Colors.white : Colors.accent} />
        </Pressable>

        {/* Walk-in / Add Walk-in */}
        <Pressable
          onPress={() => router.push('/(tabs)/walkin')}
          style={qd.walkinBtn}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
          hitSlop={8}
        >
          <Ionicons name="add-circle-outline" size={17} color={Colors.accent} />
          <Text style={qd.walkinBtnText}>Walk-in</Text>
        </Pressable>
      </View>

      {/* ── Stats strip ── */}
      <ReAnimated.View entering={FadeIn.duration(300)} style={qd.statsRow}>
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
      </ReAnimated.View>

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
          ItemSeparatorComponent={() => <View style={qd.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={qd.empty}>
              <View style={qd.emptyIconWrap}>
                <Ionicons name="checkmark-circle-outline" size={48} color={Colors.success} />
              </View>
              <Text style={qd.emptyTitle}>Queue is empty</Text>
              <Text style={qd.emptyText}>No customers waiting. Tap Walk-in to add someone.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <QueueCard
              entry={item}
              isAdmin={isAdmin}
              tvMode={tvMode}
              onAction={handleAction}
              index={index}
            />
          )}
        />
      )}

      {/* ── Call Next FAB (admin, non-TV) ── */}
      {isAdmin && !tvMode && waiting > 0 && (
        <Pressable
          style={({ pressed }) => [qd.fab, pressed && { opacity: 0.88 }]}
          onPress={callNext}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Ionicons name="arrow-up-circle" size={28} color={Colors.white} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const qd = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING, paddingTop: 8, paddingBottom: 12,
    gap: 8,
  },
  headerLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerRight: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  pulsingDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.success,
  },
  title:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  autoRefreshLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },

  tvBtn: {
    width: 36, height: 36, borderRadius: borderRadius.full,
    borderWidth: 1.5, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  tvBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  walkinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accentMuted, borderRadius: borderRadius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  walkinBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  // Countdown bar
  countdownWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  countdownTrack: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, overflow: 'hidden',
  },
  countdownFill:  { height: 4, borderRadius: 2 },
  countdownText:  { fontSize: 10, color: Colors.textMuted, fontWeight: '600', minWidth: 22 },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: SCREEN_PADDING, marginBottom: 16,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: borderRadius.md, padding: 10,
    borderLeftWidth: 3, ...cardShadow,
  },
  statNum:   { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  // List
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 100 },
  separator:   { height: 10 },

  // Card
  card: {
    backgroundColor: Colors.white, borderRadius: borderRadius.lg,
    padding: 16, ...cardShadow,
  },
  cardDim: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  numCircle: {
    width: 36, height: 36, borderRadius: borderRadius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  numText:  { fontSize: 16, fontWeight: '800', color: Colors.white },
  name:     { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  service:  { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  notes:    { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  price:    { fontSize: 14, fontWeight: '700', color: Colors.success },

  // Badge
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText:{ fontSize: 11, fontWeight: '700' },

  // Info pills
  infoRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 6, marginBottom: 8,
  },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.accentMuted, borderRadius: borderRadius.full,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  infoPillText: { fontSize: 11, color: Colors.accent, fontWeight: '600' },
  infoPillNeutral: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.full,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  infoPillNeutralText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Action chips
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.surfaceAlt, paddingTop: 10,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: borderRadius.full,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  chipText: { fontSize: 11, fontWeight: '700' },

  // FAB — circular, bottom right
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: Colors.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.successBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', maxWidth: 260 },
});
