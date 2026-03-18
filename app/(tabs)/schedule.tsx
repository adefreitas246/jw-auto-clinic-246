// app/(tabs)/schedule.tsx — Staff Schedule Screen
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleJob {
  _id:             string;
  customerName?:   string;
  vehicleLabel?:   string;
  vehicleMake?:    string;
  vehicleModel?:   string;
  vehiclePlate?:   string;
  serviceName?:    string;
  serviceLabel?:   string;
  appointmentDate: string;
  appointmentTime: string;
  status?:         string;
  jobStatus?:      string;
}

interface Shift {
  date:       string;
  startTime?: string;
  endTime?:   string;
  off?:       boolean;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Returns ISO date of Monday for the week containing the given date. */
function getMondayISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDays(mondayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayISO, i));
}

function monthYearLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  });
}

function formatTime12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

function formatShortTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12  = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}

// ── Status helpers ────────────────────────────────────────────────────────────

function resolveStatus(job: ScheduleJob): string {
  return job.status ?? job.jobStatus ?? 'assigned';
}

function borderColorForStatus(status: string): string {
  switch (status) {
    case 'assigned':      return Colors.info;
    case 'in_progress':   return Colors.warning;
    case 'completed':
    case 'finished':      return Colors.success;
    case 'quality_check': return Colors.accent;
    default:              return Colors.border;
  }
}

function statusBadgeFor(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'assigned':      return { bg: Colors.infoBg,     text: Colors.infoText,    label: 'Assigned'      };
    case 'in_progress':   return { bg: Colors.warningBg,  text: Colors.warningText, label: 'In Progress'   };
    case 'completed':     return { bg: Colors.successBg,  text: Colors.successText, label: 'Completed'     };
    case 'quality_check': return { bg: Colors.accentMuted,text: Colors.accentDark,  label: 'Quality Check' };
    case 'finished':      return { bg: Colors.successBg,  text: Colors.successText, label: 'Finished'      };
    default:              return { bg: Colors.surfaceAlt, text: Colors.textMuted,   label: status          };
  }
}

// ── Group by time of day ──────────────────────────────────────────────────────

interface DayGroups {
  morning:   ScheduleJob[];
  afternoon: ScheduleJob[];
  evening:   ScheduleJob[];
}

function groupByTimeOfDay(jobs: ScheduleJob[]): DayGroups {
  const morning:   ScheduleJob[] = [];
  const afternoon: ScheduleJob[] = [];
  const evening:   ScheduleJob[] = [];

  for (const job of jobs) {
    const hour = parseInt(job.appointmentTime?.split(':')[0] ?? '0', 10);
    if (hour < 12)      morning.push(job);
    else if (hour < 17) afternoon.push(job);
    else                evening.push(job);
  }
  return { morning, afternoon, evening };
}

// ── Week strip ────────────────────────────────────────────────────────────────

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeekStrip({
  weekDays,
  selected,
  onSelect,
}: {
  weekDays: string[];
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const today = todayISO();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ws.row}
    >
      {weekDays.map((iso, i) => {
        const d          = new Date(iso + 'T00:00:00');
        const isActive   = iso === selected;
        const isToday    = iso === today;

        return (
          <Pressable
            key={iso}
            style={[ws.pill, isActive && ws.pillActive]}
            onPress={() => onSelect(iso)}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={[ws.letter, isActive && ws.letterActive]}>
              {DAY_LETTERS[i]}
            </Text>
            <Text style={[ws.num, isActive && ws.numActive]}>
              {d.getDate()}
            </Text>
            <View style={ws.dotWrap}>
              {isToday && (
                <View style={[ws.dot, isActive && ws.dotActive]} />
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ws = StyleSheet.create({
  row:       { paddingHorizontal: SCREEN_PADDING, gap: 8, paddingVertical: 12 },
  pill:      { alignItems: 'center', width: 44, paddingVertical: 10, borderRadius: borderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  pillActive:{ backgroundColor: Colors.accent, borderColor: Colors.accent },
  letter:    { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  letterActive: { color: Colors.white },
  num:       { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  numActive: { color: Colors.white },
  dotWrap:   { height: 7, justifyContent: 'center', marginTop: 2 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  dotActive: { backgroundColor: Colors.white },
});

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({ job, index }: { job: ScheduleJob; index: number }) {
  const status      = resolveStatus(job);
  const leftColor   = borderColorForStatus(status);
  const badge       = statusBadgeFor(status);

  const vehicleLine = [job.vehicleMake, job.vehicleModel].filter(Boolean).join(' ')
    || job.vehicleLabel || '';
  const serviceLine = job.serviceName || job.serviceLabel || '—';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        style={jc.row}
        onPress={() => router.push({ pathname: '/(tabs)/jobs/[id]', params: { id: job._id } })}
        android_ripple={{ color: Colors.accent + '18', borderless: false }}
      >
        {/* Time column */}
        <View style={jc.timeCol}>
          <Text style={jc.timeText}>{formatTime12(job.appointmentTime)}</Text>
        </View>

        {/* Card */}
        <View style={[jc.card, { borderLeftColor: leftColor }]}>
          {/* Customer + status */}
          <View style={jc.topRow}>
            <Text style={jc.customerName} numberOfLines={1}>
              {job.customerName || 'Customer'}
            </Text>
            <View style={[jc.badge, { backgroundColor: badge.bg }]}>
              <Text style={[jc.badgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          </View>

          {/* Vehicle + plate */}
          {vehicleLine ? (
            <View style={jc.vehicleRow}>
              <Text style={jc.vehicleText} numberOfLines={1}>{vehicleLine}</Text>
              {job.vehiclePlate ? (
                <View style={jc.plateBadge}>
                  <Text style={jc.plateText}>{job.vehiclePlate}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Service */}
          <Text style={jc.serviceName} numberOfLines={1}>{serviceLine}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const jc = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'stretch', gap: 12, overflow: 'hidden', borderRadius: borderRadius.lg },
  timeCol:      { width: 60, alignItems: 'center', paddingTop: 16 },
  timeText:     { fontSize: 13, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  card:         { flex: 1, backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 14, borderLeftWidth: 4, gap: 4, ...cardShadow },
  topRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  customerName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  badge:        { borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:    { fontSize: 11, fontWeight: '700' },
  vehicleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleText:  { fontSize: 13, color: Colors.textMuted, flex: 1 },
  plateBadge:   { backgroundColor: Colors.surfaceAlt, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 6, paddingVertical: 1 },
  plateText:    { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  serviceName:  { fontSize: 13, color: Colors.textSecondary },
});

// ── Shifts card ───────────────────────────────────────────────────────────────

function ShiftsCard({ weekDays, shifts }: { weekDays: string[]; shifts: Shift[] }) {
  const DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Animated.View entering={FadeIn.duration(300)} style={sf.card}>
      <View style={sf.headerRow}>
        <Ionicons name="time-outline" size={16} color={Colors.accent} />
        <Text style={sf.title}>This Week's Shifts</Text>
      </View>

      <View style={sf.grid}>
        {weekDays.map((iso, i) => {
          const shift = shifts.find(s => s.date === iso);
          const isOff = !shift || shift.off;

          return (
            <View key={iso} style={sf.shiftRow}>
              <Text style={sf.dayLabel}>{DAY_ABBREVS[i]}</Text>
              {isOff ? (
                <Text style={sf.offText}>Off</Text>
              ) : (
                <Text style={sf.hoursText}>
                  {formatShortTime(shift!.startTime ?? '')}–{formatShortTime(shift!.endTime ?? '')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const sf = StyleSheet.create({
  card:      { backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title:     { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  shiftRow:  { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingRight: 8 },
  dayLabel:  { width: 30, fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  hoursText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  offText:   { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
});

// ── Section header ────────────────────────────────────────────────────────────

function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={gh.row}>
      <Text style={gh.title}>{title}</Text>
      <View style={gh.countBadge}>
        <Text style={gh.countText}>{count}</Text>
      </View>
    </View>
  );
}

const gh = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  title:      { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  countBadge: { backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countText:  { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const { user } = useAuth();

  const [weekMonday, setWeekMonday] = useState(() => getMondayISO(todayISO()));
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [jobs,        setJobs]        = useState<ScheduleJob[]>([]);
  const [shifts,      setShifts]      = useState<Shift[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const weekDays = getWeekDays(weekMonday);

  // ── When week changes, snap selected day to same weekday in new week ──────

  function navigateWeek(delta: number) {
    const newMonday = addDays(weekMonday, delta * 7);
    setWeekMonday(newMonday);
    const newWeekDays = getWeekDays(newMonday);
    // Keep same day-of-week index
    const oldIdx = weekDays.indexOf(selectedDay);
    const snapIdx = oldIdx >= 0 ? oldIdx : 0;
    setSelectedDay(newWeekDays[snapIdx]);
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = { week: weekMonday };
      if (user?._id) params.staffId = user._id;

      const [jobsRes, shiftsRes] = await Promise.allSettled([
        axios.get<ScheduleJob[]>('/api/jobs', { params }),
        axios.get<Shift[]>('/api/shifts', { params }),
      ]);

      if (jobsRes.status === 'fulfilled')   setJobs(jobsRes.value.data);
      else                                  setJobs([]);

      if (shiftsRes.status === 'fulfilled') setShifts(shiftsRes.value.data);
      else                                  setShifts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekMonday, user?._id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // ── Filter + group ─────────────────────────────────────────────────────────

  const dayJobs = jobs.filter(j => j.appointmentDate === selectedDay);
  const { morning, afternoon, evening } = groupByTimeOfDay(dayJobs);

  const selectedDateLabel = new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable
          style={s.arrowBtn}
          onPress={() => navigateWeek(-1)}
          hitSlop={8}
          android_ripple={{ color: Colors.accent + '20', borderless: true }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.accent} />
        </Pressable>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Schedule</Text>
          <Text style={s.headerSubtitle}>{monthYearLabel(weekMonday)}</Text>
        </View>

        <Pressable
          style={s.arrowBtn}
          onPress={() => navigateWeek(1)}
          hitSlop={8}
          android_ripple={{ color: Colors.accent + '20', borderless: true }}
        >
          <Ionicons name="chevron-forward" size={22} color={Colors.accent} />
        </Pressable>
      </View>

      {/* ── Week strip ── */}
      <WeekStrip weekDays={weekDays} selected={selectedDay} onSelect={setSelectedDay} />

      {/* ── Main content ── */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
        >

          {/* ── Upcoming shifts card ── */}
          {shifts.length > 0 && (
            <ShiftsCard weekDays={weekDays} shifts={shifts} />
          )}

          {/* ── Day heading ── */}
          <Text style={s.dayHeading}>{selectedDateLabel}</Text>

          {/* ── Jobs by time group ── */}
          {dayJobs.length === 0 ? (
            <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="calendar-clear-outline" size={40} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No jobs today</Text>
              <Text style={s.emptyText}>No jobs are assigned to you for this day.</Text>
            </Animated.View>
          ) : (
            <>
              {morning.length > 0 && (
                <View style={s.group}>
                  <GroupHeader title="Morning" count={morning.length} />
                  {morning.map((job, i) => (
                    <View key={job._id} style={{ marginBottom: 10 }}>
                      <JobCard job={job} index={i} />
                    </View>
                  ))}
                </View>
              )}

              {afternoon.length > 0 && (
                <View style={s.group}>
                  <GroupHeader title="Afternoon" count={afternoon.length} />
                  {afternoon.map((job, i) => (
                    <View key={job._id} style={{ marginBottom: 10 }}>
                      <JobCard job={job} index={morning.length + i} />
                    </View>
                  ))}
                </View>
              )}

              {evening.length > 0 && (
                <View style={s.group}>
                  <GroupHeader title="Evening" count={evening.length} />
                  {evening.map((job, i) => (
                    <View key={job._id} style={{ marginBottom: 10 }}>
                      <JobCard job={job} index={morning.length + afternoon.length + i} />
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

        </ScrollView>
      )}

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 4,
  },
  arrowBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 18,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },

  // Content
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: 100,
  },

  // Day heading
  dayHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 14,
  },

  // Group
  group: { marginBottom: 8 },

  // Empty
  empty:        { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 8 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText:    { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
