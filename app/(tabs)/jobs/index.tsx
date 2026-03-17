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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
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
import { Badge } from '@/components/ui';
import { ScreenHeader } from '@/components/ui';

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

function formatTime12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

// ── Status color for left border ──────────────────────────────────────────────
function borderColorForStatus(status: JobStatus): string {
  switch (status) {
    case 'assigned':    return Colors.warning;
    case 'in_progress': return Colors.accent;
    case 'finished':    return Colors.success;
    case 'cancelled':   return Colors.error;
    default:            return Colors.border;
  }
}

// ── Status badge mapping to Badge component status ───────────────────────────
function badgeStatusForJob(status: JobStatus): 'warning' | 'active' | 'success' | 'error' | 'pending' {
  switch (status) {
    case 'assigned':    return 'warning';
    case 'in_progress': return 'active';
    case 'finished':    return 'success';
    case 'cancelled':   return 'error';
    default:            return 'pending';
  }
}

// ── Summary chip ──────────────────────────────────────────────────────────────
function SummaryChip({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <View style={[jd.chip]}>
      <Text style={[jd.chipCount, { color }]}>{count}</Text>
      <Text style={jd.chipLabel}>{label}</Text>
    </View>
  );
}

// ── Job timeline row ──────────────────────────────────────────────────────────
function JobTimelineItem({ job, index }: { job: JobSummary; index: number }) {
  const borderColor = borderColorForStatus(job.jobStatus);

  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable
        style={jd.timelineRow}
        onPress={() => {
          if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/(tabs)/jobs/[id]', params: { id: job._id } });
        }}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
      >
        {/* Time column */}
        <View style={jd.timeCol}>
          <Text style={jd.timeText}>{formatTime12(job.appointmentTime)}</Text>
          <Ionicons
            name={job.locationType === 'mobile' ? 'navigate' : 'business'}
            size={12}
            color={Colors.textMuted}
            style={{ marginTop: 4 }}
          />
        </View>

        {/* Card */}
        <View style={[jd.timelineCard, { borderLeftColor: borderColor }]}>
          <View style={jd.cardTopRow}>
            <Text style={jd.customerName} numberOfLines={1}>
              {job.serviceLabel}
            </Text>
            <Badge
              status={badgeStatusForJob(job.jobStatus)}
              label={STAFF_STATUS_LABELS[job.jobStatus]}
              size="sm"
            />
          </View>
          <Text style={jd.vehicleText} numberOfLines={1}>
            {job.vehicleLabel || 'No vehicle'}
          </Text>
          <View style={jd.cardFooterRow}>
            <Text style={jd.serviceText} numberOfLines={1}>
              {job.locationType === 'mobile'
                ? (job.mobileAddress || 'Mobile')
                : (job.bayLabel || 'Bay')}
            </Text>
            <Text style={jd.priceText}>${job.totalPrice.toFixed(2)}</Text>
          </View>
        </View>
      </Pressable>
    </ReAnimated.View>
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

  // Stats
  const assignedCount    = jobs.filter(j => j.jobStatus === 'assigned').length;
  const inProgressCount  = jobs.filter(j => j.jobStatus === 'in_progress').length;
  const completedCount   = jobs.filter(j => j.jobStatus === 'finished').length;
  const cancelledCount   = jobs.filter(j => j.jobStatus === 'cancelled').length;

  return (
    <SafeAreaView style={jd.safe} edges={['top']}>
      <ScreenHeader
        title="Today's Jobs"
        subtitle={formatDate(date)}
        rightAction={
          user?.role === 'admin'
            ? {
                label: 'Manage',
                icon: 'settings-outline',
                onPress: () => {
                  if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/jobs/manage');
                },
              }
            : {
                label: 'Scan QR',
                icon: 'qr-code-outline',
                onPress: () => {
                  if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/scanner');
                },
              }
        }
      />

      {/* ── Date navigation ── */}
      <View style={jd.datePicker}>
        <Pressable
          style={jd.dateArrow}
          onPress={() => shiftDate(-1)}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
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
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color={Colors.accent} />
        </Pressable>
      </View>

      {/* ── Summary chips (horizontal scroll) ── */}
      {jobs.length > 0 && (
        <ReAnimated.View entering={FadeIn.duration(300)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={jd.chipsRow}
          >
            <SummaryChip count={assignedCount}   label="Assigned"    color={Colors.warning} />
            <SummaryChip count={inProgressCount} label="In Progress" color={Colors.accent} />
            <SummaryChip count={completedCount}  label="Completed"   color={Colors.success} />
            <SummaryChip count={cancelledCount}  label="Cancelled"   color={Colors.error} />
          </ScrollView>
        </ReAnimated.View>
      )}

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
          ListEmptyComponent={
            <ReAnimated.View entering={FadeIn.duration(300)} style={jd.empty}>
              <View style={jd.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
              </View>
              <Text style={jd.emptyTitle}>No jobs scheduled</Text>
              <Text style={jd.emptyText}>
                There are no confirmed bookings for{'\n'}{formatDate(date)}.
              </Text>
            </ReAnimated.View>
          }
          renderItem={({ item, index }) => (
            <JobTimelineItem job={item} index={index} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const jd = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Date picker strip
  datePicker: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SCREEN_PADDING, marginVertical: 12,
    backgroundColor: Colors.surface, borderRadius: borderRadius.lg,
    paddingVertical: 10, paddingHorizontal: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  dateArrow: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  dateText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  todayBadge: {
    marginTop: 4, backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 2,
  },
  todayBadgeText: { fontSize: 11, color: Colors.accent, fontWeight: '700' },

  // Summary chips
  chipsRow: { paddingHorizontal: SCREEN_PADDING, gap: 8, paddingBottom: 100 },
  chip: {
    alignItems: 'center', minWidth: 90,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  chipCount: { fontSize: 22, fontWeight: '800' },
  chipLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },

  // Timeline
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 100, gap: 8 },
  timelineRow: {
    flexDirection: 'row', alignItems: 'stretch', gap: 12,
  },
  timeCol: {
    width: 60, alignItems: 'center', paddingTop: 14,
  },
  timeText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  // Timeline card
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    borderLeftWidth: 4,
    ...cardShadow,
  },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  customerName: {
    fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8,
  },
  vehicleText: { fontSize: 13, color: Colors.textMuted, marginBottom: 6 },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  priceText:   { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: borderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
