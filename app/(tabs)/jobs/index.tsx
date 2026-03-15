// app/(tabs)/jobs/index.tsx — Staff Job Dashboard
// Shows today's confirmed bookings for this business, sorted by appointment time.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import {
  JobSummary,
  JobStatus,
  STAFF_STATUS_LABELS,
  STAFF_STATUS_COLORS,
} from '@/types/job';
import { Colors } from '@/constants/Colors';

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
  return (
    <Pressable
      style={({ pressed }) => [jd.card, pressed && { opacity: 0.88 }]}
      onPress={() => router.push({ pathname: '/(tabs)/jobs/[id]', params: { id: job._id } })}
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
          <Text style={jd.locLabel}>
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
        <Text style={jd.dur}>{job.durationMinutes} min</Text>
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
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const isToday = date === todayISO();

  const byStatus: Record<string, JobSummary[]> = {};
  for (const j of jobs) {
    const s = STAFF_STATUS_LABELS[j.jobStatus] ?? j.jobStatus;
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(j);
  }

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
          {/* QR scanner — all staff can use this */}
          <Pressable
            style={jd.adminBtn}
            onPress={() => router.push('/(tabs)/scanner')}
            hitSlop={8}
          >
            <Ionicons name="qr-code-outline" size={15} color={Colors.accent} />
            <Text style={jd.adminBtnText}>Scan QR</Text>
          </Pressable>
          {user?.role === 'admin' && (
            <Pressable
              style={jd.adminBtn}
              onPress={() => router.push('/(tabs)/jobs/manage')}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={15} color={Colors.accent} />
              <Text style={jd.adminBtnText}>Manage</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Date navigation ── */}
      <View style={jd.datePicker}>
        <Pressable style={jd.dateBtn} onPress={() => shiftDate(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={Colors.accent} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={jd.dateText}>{formatDate(date)}</Text>
          {isToday && <Text style={jd.todayPill}>Today</Text>}
        </View>
        <Pressable style={jd.dateBtn} onPress={() => shiftDate(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListHeaderComponent={
            jobs.length > 0 ? (
              <View style={jd.statsRow}>
                <View style={jd.statPill}>
                  <Text style={jd.statNum}>{jobs.length}</Text>
                  <Text style={jd.statLabel}>Jobs</Text>
                </View>
                <View style={jd.statPill}>
                  <Text style={jd.statNum}>
                    {jobs.filter(j => j.jobStatus === 'finished').length}
                  </Text>
                  <Text style={jd.statLabel}>Done</Text>
                </View>
                <View style={jd.statPill}>
                  <Text style={jd.statNum}>
                    {jobs.filter(j =>
                      j.jobStatus === 'assigned' || j.jobStatus === 'in_progress'
                    ).length}
                  </Text>
                  <Text style={jd.statLabel}>Active</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={jd.empty}>
              <Ionicons name="calendar-outline" size={52} color={Colors.border} />
              <Text style={jd.emptyTitle}>No jobs scheduled</Text>
              <Text style={jd.emptyText}>
                There are no confirmed bookings for{'\n'}{formatDate(date)}.
              </Text>
            </View>
          }
          renderItem={({ item }) => <JobCard job={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const jd = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  sub:      { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f3eafd', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  adminBtnText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // Date picker strip
  datePicker: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8,
    ...SHADOW,
  },
  dateBtn:  { padding: 6 },
  dateText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  todayPill:{ fontSize: 11, color: Colors.accent, fontWeight: '700', marginTop: 2 },

  // Stats
  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statPill:  { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 12, alignItems: 'center', ...SHADOW },
  statNum:   { fontSize: 22, fontWeight: '800', color: Colors.accent },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 110 },

  // Job card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOW,
  },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  timeRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
  time:       { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  locLabel:   { fontSize: 12, color: Colors.textMuted, flex: 1 },
  service:    { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  vehicle:    { fontSize: 13, color: Colors.textMuted, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: Colors.background, paddingTop: 10 },
  price:      { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  dur:        { fontSize: 12, color: Colors.textMuted },

  // Status badge
  badge:     { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 6 },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
