// app/(tabs)/jobs/index.tsx — Staff Job Dashboard
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = 'assigned' | 'in_progress' | 'completed' | 'quality_check' | 'cancelled';

interface Job {
  _id:             string;
  customerName:    string;
  vehicleMake?:    string;
  vehicleModel?:   string;
  vehiclePlate?:   string;
  vehicleLabel?:   string;
  serviceName:     string;
  appointmentTime: string;
  status:          JobStatus;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

function statusBorderColor(status: JobStatus): string {
  switch (status) {
    case 'assigned':      return Colors.info;
    case 'in_progress':   return Colors.warning;
    case 'completed':     return Colors.success;
    case 'quality_check': return Colors.accent;
    default:              return Colors.border;
  }
}

function statusBadgeStyle(status: JobStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'assigned':      return { bg: Colors.infoBg,    text: Colors.infoText,    label: 'Assigned'       };
    case 'in_progress':   return { bg: Colors.warningBg, text: Colors.warningText, label: 'In Progress'    };
    case 'completed':     return { bg: Colors.successBg, text: Colors.successText, label: 'Completed'      };
    case 'quality_check': return { bg: Colors.accentMuted, text: Colors.accentDark, label: 'Quality Check' };
    case 'cancelled':     return { bg: Colors.errorBg,   text: Colors.errorText,   label: 'Cancelled'      };
    default:              return { bg: Colors.surfaceAlt, text: Colors.textMuted,   label: status           };
  }
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 750 }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[sk.row, animStyle]}>
      <View style={sk.timeCol}>
        <View style={sk.timeLine} />
      </View>
      <View style={sk.card}>
        <View style={sk.lineLg} />
        <View style={sk.lineMd} />
        <View style={sk.lineSm} />
      </View>
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: 10 },
  timeCol: { width: 60, paddingTop: 14, alignItems: 'center' },
  timeLine:{ width: 44, height: 12, borderRadius: 6, backgroundColor: Colors.border },
  card:    { flex: 1, backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 14, borderLeftWidth: 4, borderLeftColor: Colors.border, gap: 8, ...cardShadow },
  lineLg:  { height: 14, borderRadius: 7, backgroundColor: Colors.border, width: '65%' },
  lineMd:  { height: 11, borderRadius: 6, backgroundColor: Colors.surfaceAlt, width: '45%' },
  lineSm:  { height: 10, borderRadius: 5, backgroundColor: Colors.surfaceAlt, width: '30%' },
});

// ── Summary chip ──────────────────────────────────────────────────────────────

type ChipFilter = JobStatus | null;

function SummaryChip({
  label,
  count,
  bg,
  color,
  active,
  onPress,
}: {
  label:   string;
  count:   number;
  bg:      string;
  color:   string;
  active:  boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        ch.chip,
        { backgroundColor: bg },
        active && { borderWidth: 1.5, borderColor: color },
      ]}
      onPress={onPress}
      android_ripple={{ color: color + '30', borderless: false }}
    >
      <Text style={[ch.count, { color }, active && ch.countActive]}>{count}</Text>
      <Text style={[ch.label, { color }, active && ch.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const ch = StyleSheet.create({
  chip:        { alignItems: 'center', minWidth: 84, borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: 'transparent' },
  count:       { fontSize: 20, fontWeight: '800' },
  countActive: { fontSize: 22 },
  label:       { fontSize: 11, fontWeight: '600', marginTop: 2 },
  labelActive: { fontSize: 12 },
});

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({ job, index }: { job: Job; index: number }) {
  const borderColor = statusBorderColor(job.status);
  const badge       = statusBadgeStyle(job.status);

  const vehicleParts = [job.vehicleMake, job.vehicleModel].filter(Boolean).join(' ')
    || job.vehicleLabel
    || 'No vehicle';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        style={jd.timelineRow}
        onPress={() => router.push({ pathname: '/(tabs)/jobs/[id]', params: { id: job._id } })}
        android_ripple={{ color: Colors.accent + '18', borderless: false }}
      >
        {/* Time column */}
        <View style={jd.timeCol}>
          <Text style={jd.timeText}>{formatTime(job.appointmentTime)}</Text>
        </View>

        {/* Card */}
        <View style={[jd.card, { borderLeftColor: borderColor }]}>
          {/* Row 1: customer name + status badge */}
          <View style={jd.cardTopRow}>
            <Text style={jd.customerName} numberOfLines={1}>{job.customerName}</Text>
            <View style={[jd.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[jd.statusText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          </View>

          {/* Row 2: vehicle */}
          <View style={jd.vehicleRow}>
            <Text style={jd.vehicleName} numberOfLines={1}>{vehicleParts}</Text>
            {job.vehiclePlate ? (
              <View style={jd.plateBadge}>
                <Text style={jd.plateText}>{job.vehiclePlate}</Text>
              </View>
            ) : null}
          </View>

          {/* Row 3: service */}
          <Text style={jd.serviceName} numberOfLines={1}>{job.serviceName}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function JobDashboard() {
  const { user } = useAuth();

  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChip, setActiveChip] = useState<ChipFilter>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = { date: 'today' };
      if (user?._id) params.staffId = user._id;
      const { data } = await axios.get<Job[]>('/api/jobs', { params });
      setJobs(data);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchJobs();
    pollRef.current = setInterval(() => fetchJobs(true), 60_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs(true);
  }, [fetchJobs]);

  // ── Derived counts ──────────────────────────────────────────────────────────
  const assignedCount   = jobs.filter(j => j.status === 'assigned').length;
  const inProgressCount = jobs.filter(j => j.status === 'in_progress').length;
  const completedCount  = jobs.filter(j => j.status === 'completed').length;

  // ── Filtered list ───────────────────────────────────────────────────────────
  const displayed = activeChip ? jobs.filter(j => j.status === activeChip) : jobs;

  const isAdminOrManager = user?.role === 'admin';

  return (
    <SafeAreaView style={jd.safe} edges={['top']}>

      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(300)} style={jd.header}>
        <View style={{ flex: 1 }}>
          <Text style={jd.title}>Today's Jobs</Text>
          <Text style={jd.dateSubtitle}>{todayLabel()}</Text>
        </View>
        <Pressable
          style={jd.bellBtn}
          hitSlop={8}
          android_ripple={{ color: Colors.accent + '20', borderless: true }}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
        </Pressable>
      </Animated.View>

      {/* ── Summary chips ── */}
      <Animated.View entering={FadeIn.delay(80).duration(300)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={jd.chipsRow}
        >
          <SummaryChip
            label="Assigned"
            count={assignedCount}
            bg={Colors.infoBg}
            color={Colors.info}
            active={activeChip === 'assigned'}
            onPress={() => setActiveChip(prev => prev === 'assigned' ? null : 'assigned')}
          />
          <SummaryChip
            label="In Progress"
            count={inProgressCount}
            bg={Colors.warningBg}
            color={Colors.warning}
            active={activeChip === 'in_progress'}
            onPress={() => setActiveChip(prev => prev === 'in_progress' ? null : 'in_progress')}
          />
          <SummaryChip
            label="Completed"
            count={completedCount}
            bg={Colors.successBg}
            color={Colors.success}
            active={activeChip === 'completed'}
            onPress={() => setActiveChip(prev => prev === 'completed' ? null : 'completed')}
          />
        </ScrollView>
      </Animated.View>

      {/* ── List / skeleton / empty ── */}
      {loading ? (
        <View style={jd.listPadding}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={j => j._id}
          contentContainerStyle={jd.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(300)} style={jd.empty}>
              <View style={jd.emptyIconWrap}>
                <Ionicons name="briefcase-outline" size={40} color={Colors.textMuted} />
              </View>
              <Text style={jd.emptyTitle}>No jobs assigned today</Text>
              <Text style={jd.emptyText}>Your schedule is clear for now.</Text>
              <Pressable
                style={jd.scheduleBtn}
                onPress={() => router.push('/(tabs)/schedule')}
                android_ripple={{ color: Colors.white + '30', borderless: false }}
              >
                <Text style={jd.scheduleBtnText}>Check your schedule</Text>
              </Pressable>
            </Animated.View>
          }
          renderItem={({ item, index }) => (
            <JobCard job={item} index={index} />
          )}
        />
      )}

      {/* ── FAB (admin only) ── */}
      {isAdminOrManager && (
        <Pressable
          style={jd.fab}
          onPress={() => router.push('/(tabs)/jobs/new' as any)}
          android_ripple={{ color: Colors.white + '40', borderless: false }}
        >
          <Ionicons name="add" size={28} color={Colors.white} />
        </Pressable>
      )}

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const jd = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title:       { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  dateSubtitle:{ fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  bellBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },

  // Chips
  chipsRow: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 12,
    gap: 8,
  },

  // List
  listPadding: { paddingHorizontal: SCREEN_PADDING, paddingTop: 4 },
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 100 },

  // Timeline row
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
  },
  timeCol: {
    width: 60,
    alignItems: 'center',
    paddingTop: 16,
  },
  timeText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    borderLeftWidth: 4,
    gap: 4,
    ...cardShadow,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Vehicle row
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleName: {
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
  },
  plateBadge: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  plateText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // Service
  serviceName: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconWrap: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  scheduleBtn: {
    marginTop: 12,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: 24,
    paddingVertical: 11,
    overflow: 'hidden',
  },
  scheduleBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
});
