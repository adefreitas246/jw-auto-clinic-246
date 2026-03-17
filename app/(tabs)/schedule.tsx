// app/(tabs)/schedule.tsx — Staff Schedule Screen
// Shows the current staff member's assigned jobs for a given day.
// Date nav (prev/next), week overview strip, timeline list.
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

import { JobSummary, JobStatus, STAFF_STATUS_LABELS } from '@/types/job';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { Badge } from '@/components/ui';
import { ScreenHeader } from '@/components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDateLong(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function formatTime12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ─── Week strip ───────────────────────────────────────────────────────────────

function WeekStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (iso: string) => void;
}) {
  // Build 7-day window centred on today
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={sc.weekStrip}
    >
      {days.map((iso) => {
        const d     = new Date(iso + 'T00:00:00');
        const isSelected = iso === selected;
        const isToday    = iso === today;
        return (
          <Pressable
            key={iso}
            style={[sc.dayPill, isSelected && sc.dayPillActive]}
            onPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(iso);
            }}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={[sc.dayName, isSelected && sc.dayNameActive]}>
              {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
            <Text style={[sc.dayNum, isSelected && sc.dayNumActive]}>
              {d.getDate()}
            </Text>
            {isToday && <View style={[sc.todayDot, isSelected && sc.todayDotActive]} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function badgeStatus(status: JobStatus): 'warning' | 'active' | 'success' | 'error' | 'pending' {
  switch (status) {
    case 'assigned':      return 'warning';
    case 'in_progress':   return 'active';
    case 'finished':      return 'success';
    case 'quality_check': return 'pending';
    default:              return 'error';
  }
}

// ─── Timeline row ─────────────────────────────────────────────────────────────

function ScheduleItem({ job, index }: { job: JobSummary; index: number }) {
  const borderColor = (() => {
    switch (job.jobStatus) {
      case 'assigned':      return Colors.warning;
      case 'in_progress':   return Colors.accent;
      case 'quality_check': return Colors.info;
      case 'finished':      return Colors.success;
      default:              return Colors.border;
    }
  })();

  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable
        style={sc.row}
        onPress={() => {
          if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/(tabs)/jobs/[id]', params: { id: job._id } });
        }}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
      >
        {/* Time column */}
        <View style={sc.timeCol}>
          <Text style={sc.timeText}>{formatTime12(job.appointmentTime)}</Text>
          <Text style={sc.durText}>{formatDuration(job.durationMinutes)}</Text>
        </View>

        {/* Card */}
        <View style={[sc.card, { borderLeftColor: borderColor }]}>
          <View style={sc.cardTop}>
            <Text style={sc.cardTitle} numberOfLines={1}>{job.serviceLabel}</Text>
            <Badge status={badgeStatus(job.jobStatus)} label={STAFF_STATUS_LABELS[job.jobStatus]} size="sm" />
          </View>
          <Text style={sc.cardVehicle} numberOfLines={1}>{job.vehicleLabel || 'No vehicle'}</Text>
          <View style={sc.cardFooter}>
            <Ionicons
              name={job.locationType === 'mobile' ? 'navigate-outline' : 'business-outline'}
              size={12}
              color={Colors.textMuted}
            />
            <Text style={sc.cardLoc} numberOfLines={1}>
              {job.locationType === 'mobile'
                ? (job.mobileAddress || 'Mobile')
                : (job.bayLabel || 'Bay')}
            </Text>
            <Text style={sc.cardPrice}>${job.totalPrice.toFixed(2)}</Text>
          </View>
        </View>
      </Pressable>
    </ReAnimated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const { user } = useAuth();
  const [date,       setDate]       = useState(todayISO());
  const [jobs,       setJobs]       = useState<JobSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = { date };
      if (user?.role === 'staff' && user._id) params.staffId = user._id;
      const { data } = await axios.get<JobSummary[]>('/api/jobs', { params });
      setJobs(data);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date, user]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs(true);
  }, [fetchJobs]);

  const shiftDate = (delta: number) => {
    if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDate(prev => addDays(prev, delta));
  };

  const isToday         = date === todayISO();
  const completedToday  = jobs.filter(j => j.jobStatus === 'finished').length;
  const remaining       = jobs.filter(j => j.jobStatus !== 'finished').length;
  const totalEarnings   = jobs
    .filter(j => j.jobStatus === 'finished')
    .reduce((s, j) => s + j.totalPrice, 0);

  return (
    <SafeAreaView style={sc.safe} edges={['top']}>
      <ScreenHeader
        title="My Schedule"
        subtitle={formatDateLong(date)}
        rightAction={isToday ? undefined : {
          label: 'Today',
          icon: 'today-outline',
          onPress: () => {
            if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDate(todayISO());
          },
        }}
      />

      {/* Week strip */}
      <WeekStrip selected={date} onSelect={setDate} />

      {/* Day nav */}
      <View style={sc.dayNav}>
        <Pressable
          style={sc.navBtn}
          onPress={() => shiftDate(-1)}
          android_ripple={{ color: Colors.accent + '20', borderless: true }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.accent} />
        </Pressable>
        <View style={sc.dayNavCenter}>
          <Text style={sc.dayNavDate}>{formatDateLong(date)}</Text>
          {isToday && (
            <View style={sc.todayBadge}>
              <Text style={sc.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>
        <Pressable
          style={sc.navBtn}
          onPress={() => shiftDate(1)}
          android_ripple={{ color: Colors.accent + '20', borderless: true }}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
        </Pressable>
      </View>

      {/* Summary pills */}
      {!loading && jobs.length > 0 && (
        <ReAnimated.View entering={FadeIn.duration(300)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sc.pillsRow}
          >
            <View style={sc.pill}>
              <Text style={[sc.pillNum, { color: Colors.accent }]}>{jobs.length}</Text>
              <Text style={sc.pillLabel}>Total</Text>
            </View>
            <View style={sc.pill}>
              <Text style={[sc.pillNum, { color: Colors.success }]}>{completedToday}</Text>
              <Text style={sc.pillLabel}>Done</Text>
            </View>
            <View style={sc.pill}>
              <Text style={[sc.pillNum, { color: Colors.warning }]}>{remaining}</Text>
              <Text style={sc.pillLabel}>Remaining</Text>
            </View>
            {totalEarnings > 0 && (
              <View style={sc.pill}>
                <Text style={[sc.pillNum, { color: Colors.success }]}>${totalEarnings.toFixed(0)}</Text>
                <Text style={sc.pillLabel}>Earned</Text>
              </View>
            )}
          </ScrollView>
        </ReAnimated.View>
      )}

      {/* Job list */}
      {loading ? (
        <View style={sc.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={j => j._id}
          contentContainerStyle={sc.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <ReAnimated.View entering={FadeIn.duration(300)} style={sc.empty}>
              <View style={sc.emptyIconWrap}>
                <Ionicons name="calendar-clear-outline" size={40} color={Colors.textMuted} />
              </View>
              <Text style={sc.emptyTitle}>Nothing scheduled</Text>
              <Text style={sc.emptyText}>
                No jobs are assigned to you for{'\n'}{formatDateLong(date)}.
              </Text>
            </ReAnimated.View>
          }
          renderItem={({ item, index }) => <ScheduleItem job={item} index={index} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Week strip
  weekStrip: { paddingHorizontal: SCREEN_PADDING, gap: 8, paddingVertical: 12 },
  dayPill: {
    alignItems: 'center', width: 44, paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  dayPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayName:       { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  dayNameActive: { color: Colors.white },
  dayNum:        { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  dayNumActive:  { color: Colors.white },
  todayDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 3 },
  todayDotActive:{ backgroundColor: Colors.white },

  // Day nav bar
  dayNav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 8,
    marginBottom: 4,
  },
  navBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dayNavCenter: { flex: 1, alignItems: 'center' },
  dayNavDate:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  todayBadge:   {
    marginTop: 4, backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 2,
  },
  todayBadgeText: { fontSize: 11, color: Colors.accent, fontWeight: '700' },

  // Summary pills
  pillsRow: { paddingHorizontal: SCREEN_PADDING, gap: 8, paddingBottom: 8 },
  pill: {
    alignItems: 'center', minWidth: 80,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  pillNum:   { fontSize: 20, fontWeight: '800' },
  pillLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },

  // Timeline
  listContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: SCROLL_PADDING_BOTTOM,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },

  // Time column
  timeCol:  { width: 58, alignItems: 'center', paddingTop: 14 },
  timeText: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', textAlign: 'center' },
  durText:  { fontSize: 10, color: Colors.textMuted, marginTop: 4 },

  // Job card
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    borderLeftWidth: 4,
    ...cardShadow,
  },
  cardTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  cardVehicle: { fontSize: 13, color: Colors.textMuted, marginBottom: 6 },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardLoc:     { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  cardPrice:   { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },

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
