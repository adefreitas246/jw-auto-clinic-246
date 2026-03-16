// app/(tabs)/jobs/index.tsx — Staff Job Dashboard
// Shows today's confirmed bookings for this business, sorted by appointment time.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import axios from 'axios';

import {
  JobSummary,
  JobStatus,
  STAFF_STATUS_LABELS,
  STAFF_STATUS_COLORS,
} from '@/types/job';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: JobStatus }) {
  const { bg, text } = STAFF_STATUS_COLORS[status];
  return (
    <View style={[jd.badge, { backgroundColor: bg }]}>
      <Text style={[jd.badgeText, { color: text }]}>
        {STAFF_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// ── Job card ─────────────────────────────────────────────────────────────────
function JobCard({ job }: { job: JobSummary }) {
  const { bg } = STAFF_STATUS_COLORS[job.jobStatus];
  return (
    <Pressable
      style={({ pressed }) => [jd.card, { borderLeftColor: bg }, pressed && { opacity: 0.88 }]}
      onPress={() => {
        if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/(tabs)/jobs/[id]', params: { id: job._id } });
      }}
      android_ripple={{ color: Colors.accentMuted }}
    >
      {/* Time + location type */}
      <View style={jd.cardTop}>
        <View style={jd.timeRow}>
          <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
          <Text style={jd.time}>{job.appointmentTime}</Text>
          <Ionicons
            name={job.locationType === 'mobile' ? 'navigate' : 'business'}
            size={13}
            color={Colors.textMuted}
            style={{ marginLeft: 8 }}
          />
          <Text style={jd.locLabel} numberOfLines={1}>
            {job.locationType === 'mobile'
              ? (job.mobileAddress || 'Mobile')
              : (job.bayLabel || 'Bay')}
          </Text>
        </View>
        <StatusBadge status={job.jobStatus} />
      </View>

      {/* Service + vehicle */}
      <Text style={jd.service} numberOfLines={1}>{job.serviceLabel}</Text>
      <View style={jd.vehicleRow}>
        <Ionicons name="car-outline" size={14} color={Colors.textMuted} />
        <Text style={jd.vehicle} numberOfLines={1}>{job.vehicleLabel || 'No vehicle'}</Text>
      </View>

      {/* Footer: price + duration + chevron */}
      <View style={jd.cardFooter}>
        <Text style={jd.price}>${job.totalPrice.toFixed(2)}</Text>
        <View style={jd.durChip}>
          <Ionicons name="hourglass-outline" size={11} color={Colors.textMuted} />
          <Text style={jd.dur}>{job.durationMinutes} min</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.border} style={{ marginLeft: 'auto' }} />
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function JobDashboard() {
  const { user } = useAuth();
  const [jobs,       setJobs]       = useState<JobSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [date,       setDate]       = useState(todayISO());

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<JobSummary[]>(`/api/jobs?date=${date}`);
      setJobs(data);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs(true);
  }, [fetchJobs]);

  // Navigate date ± 1 day
  const shiftDate = (delta: number) => {
    if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const isToday = date === todayISO();

  return (
    <SafeAreaView style={jd.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={jd.header}>
        <View>
          <Text style={jd.greeting}>
            Hey{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </Text>
          <Text style={jd.sub}>Staff Dashboard</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={jd.headerBtn}
            onPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/scanner');
            }}
            android_ripple={{ color: Colors.accentMuted, borderless: true, radius: 20 }}
            hitSlop={8}
          >
            <Ionicons name="qr-code-outline" size={15} color={Colors.accent} />
            <Text style={jd.headerBtnText}>Scan QR</Text>
          </Pressable>
          {user?.role === 'admin' && (
            <Pressable
              style={jd.headerBtn}
              onPress={() => {
                if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/jobs/manage');
              }}
              android_ripple={{ color: Colors.accentMuted, borderless: true, radius: 20 }}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={15} color={Colors.accent} />
              <Text style={jd.headerBtnText}>Manage</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Date navigation ── */}
      <View style={jd.datePicker}>
        <Pressable
          style={jd.dateArrow}
          onPress={() => shiftDate(-1)}
          android_ripple={{ color: Colors.accentMuted, borderless: true, radius: 20 }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.accent} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={jd.dateText}>{formatDate(date)}</Text>
          {isToday && (
            <View style={jd.todayBadge}>
              <Text style={jd.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>
        <Pressable
          style={jd.dateArrow}
          onPress={() => shiftDate(1)}
          android_ripple={{ color: Colors.accentMuted, borderless: true, radius: 20 }}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color={Colors.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={jd.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={j => j._id}
          contentContainerStyle={jd.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={jd.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListHeaderComponent={
            jobs.length > 0 ? (
              <Animated.View entering={FadeIn.duration(300)} style={jd.statsRow}>
                <View style={jd.statPill}>
                  <Text style={jd.statNum}>{jobs.length}</Text>
                  <Text style={jd.statLabel}>Total</Text>
                </View>
                <View style={[jd.statPill, jd.statPillAccent]}>
                  <Text style={[jd.statNum, { color: Colors.accent }]}>
                    {jobs.filter(j =>
                      j.jobStatus === 'assigned' || j.jobStatus === 'in_progress'
                    ).length}
                  </Text>
                  <Text style={jd.statLabel}>Active</Text>
                </View>
                <View style={[jd.statPill, jd.statPillSuccess]}>
                  <Text style={[jd.statNum, { color: Colors.success }]}>
                    {jobs.filter(j => j.jobStatus === 'finished').length}
                  </Text>
                  <Text style={jd.statLabel}>Done</Text>
                </View>
              </Animated.View>
            ) : null
          }
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(300)} style={jd.empty}>
              <View style={jd.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
              </View>
              <Text style={jd.emptyTitle}>No jobs scheduled</Text>
              <Text style={jd.emptyText}>
                There are no confirmed bookings for{'\n'}{formatDate(date)}.
              </Text>
            </Animated.View>
          }
          renderItem={({ item }) => <JobCard job={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const jd = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING, paddingTop: 8, paddingBottom: 12,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  sub:      { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accentMuted, borderRadius: borderRadius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  headerBtnText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // Date picker strip
  datePicker: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SCREEN_PADDING, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: borderRadius.lg,
    paddingVertical: 10, paddingHorizontal: 4,
    ...cardShadow,
  },
  dateArrow:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full },
  dateText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  todayBadge: {
    marginTop: 4, backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 2,
  },
  todayBadgeText: { fontSize: 11, color: Colors.accent, fontWeight: '700' },

  // Stats
  statsRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statPill:       { flex: 1, backgroundColor: Colors.white, borderRadius: borderRadius.md, padding: 12, alignItems: 'center', ...cardShadow },
  statPillAccent: { borderTopWidth: 3, borderTopColor: Colors.accent },
  statPillSuccess:{ borderTopWidth: 3, borderTopColor: Colors.success },
  statNum:        { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLabel:      { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // List
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 100 },
  separator:   { height: 10 },

  // Job card
  card: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderLeftWidth: 4,
    ...cardShadow,
  },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  timeRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
  time:       { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  locLabel:   { fontSize: 12, color: Colors.textMuted, flex: 1 },
  service:    { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  vehicle:    { fontSize: 13, color: Colors.textMuted, flex: 1 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.surfaceAlt, paddingTop: 10,
  },
  price:   { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  durChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  dur:     { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Status badge
  badge:     { borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Empty
  empty:       { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: borderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText:   { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
