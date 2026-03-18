// app/(tabs)/performance.tsx — Staff Performance Screen
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all';

interface Review {
  _id:          string;
  customerName: string;
  rating:       number;
  comment?:     string;
  date:         string;
  serviceName?: string;
}

interface PerformanceData {
  jobsCompleted:    number;
  avgJobDuration:   number;
  revenueGenerated: number;
  streak:           number;
  avgRating:        number;
  totalRatings:     number;
  ratingBreakdown:  { star: number; count: number }[];
  dailyJobs:        { date: string; count: number }[];
  recentReviews:    Review[];
  achievements:     string[];
}

// ── Achievement definitions ───────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: 'first_10',     icon: 'briefcase-outline' as const,  label: 'First 10 Jobs',  desc: 'Complete 10 jobs'               },
  { id: 'perfect_week', icon: 'calendar-outline'  as const,  label: 'Perfect Week',   desc: 'No cancellations in a week'     },
  { id: 'five_star',    icon: 'star-outline'      as const,  label: '5-Star Streak',  desc: '5 five-star reviews in a row'   },
  { id: 'century',      icon: 'trophy-outline'    as const,  label: 'Century',        desc: 'Complete 100 jobs'              },
  { id: 'speed_demon',  icon: 'flash-outline'     as const,  label: 'Speed Demon',    desc: 'Avg job time under 30 min'      },
  { id: 'revenue_1k',   icon: 'cash-outline'      as const,  label: '$1K Revenue',    desc: 'Generate $1,000 in revenue'     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

function formatDuration(mins: number): string {
  if (!mins) return '—';
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

function anonymizeName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ h, w = '100%', radius = 8, mb = 0 }: { h: number; w?: number | string; radius?: number; mb?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ height: h, width: w, borderRadius: radius, backgroundColor: Colors.border, marginBottom: mb, opacity }} />
  );
}

function SkeletonScreen() {
  return (
    <View style={{ padding: SCREEN_PADDING, gap: 14 }}>
      <SkeletonBlock h={120} radius={16} mb={0} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SkeletonBlock h={90} w="47%" radius={16} />
        <SkeletonBlock h={90} w="47%" radius={16} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SkeletonBlock h={90} w="47%" radius={16} />
        <SkeletonBlock h={90} w="47%" radius={16} />
      </View>
      <SkeletonBlock h={160} radius={16} mb={0} />
      <SkeletonBlock h={120} radius={16} mb={0} />
    </View>
  );
}

// ── Period toggle ─────────────────────────────────────────────────────────────

function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const options: { value: Period; label: string }[] = [
    { value: 'week',  label: 'This Week'  },
    { value: 'month', label: 'Month'      },
    { value: 'all',   label: 'All Time'   },
  ];

  return (
    <View style={pt.row}>
      {options.map(o => (
        <Pressable
          key={o.value}
          style={[pt.pill, period === o.value && pt.pillActive]}
          onPress={() => onChange(o.value)}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Text style={[pt.label, period === o.value && pt.labelActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const pt = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 8 },
  pill:       { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: borderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  pillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  label:      { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  labelActive:{ color: Colors.white },
});

// ── Rating card ───────────────────────────────────────────────────────────────

function RatingCard({ avgRating, totalRatings, breakdown }: {
  avgRating:   number;
  totalRatings: number;
  breakdown:   { star: number; count: number }[];
}) {
  const maxCount = Math.max(...breakdown.map(b => b.count), 1);
  const ratingColor = avgRating >= 4.5 ? Colors.success : avgRating >= 3.5 ? Colors.warning : Colors.error;

  return (
    <ReAnimated.View entering={FadeInDown.delay(60).springify()} style={rc.card}>
      {/* Big rating + stars */}
      <View style={rc.heroRow}>
        <View style={rc.heroLeft}>
          <Text style={[rc.bigRating, { color: ratingColor }]}>
            {totalRatings > 0 ? avgRating.toFixed(1) : '—'}
          </Text>
          <View style={rc.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <Ionicons
                key={n}
                name={avgRating >= n ? 'star' : avgRating >= n - 0.5 ? 'star-half' : 'star-outline'}
                size={18}
                color={Colors.warning}
              />
            ))}
          </View>
          <Text style={rc.ratingCount}>Based on {totalRatings} review{totalRatings !== 1 ? 's' : ''}</Text>
        </View>

        {/* Breakdown bars */}
        <View style={rc.breakdownCol}>
          {[5, 4, 3, 2, 1].map(star => {
            const entry = breakdown.find(b => b.star === star);
            const count = entry?.count ?? 0;
            const pct   = maxCount > 0 ? count / maxCount : 0;
            return (
              <View key={star} style={rc.barRow}>
                <Text style={rc.starNum}>{star}★</Text>
                <View style={rc.barTrack}>
                  <View style={[rc.barFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                </View>
                <Text style={rc.barPct}>{totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ReAnimated.View>
  );
}

const rc = StyleSheet.create({
  card:          { backgroundColor: Colors.surface, borderRadius: borderRadius.xl, padding: 20, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  heroRow:       { flexDirection: 'row', alignItems: 'center', gap: 20 },
  heroLeft:      { alignItems: 'center', minWidth: 90 },
  bigRating:     { fontSize: 52, fontWeight: '800', lineHeight: 60 },
  starsRow:      { flexDirection: 'row', gap: 2, marginTop: 4 },
  ratingCount:   { fontSize: 11, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  breakdownCol:  { flex: 1, gap: 6 },
  barRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starNum:       { fontSize: 11, color: Colors.textMuted, width: 24, textAlign: 'right' },
  barTrack:      { flex: 1, height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  barFill:       { height: '100%', backgroundColor: Colors.warning, borderRadius: 4 },
  barPct:        { fontSize: 10, color: Colors.textMuted, width: 28, textAlign: 'right' },
});

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, index }: {
  icon:  React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
  index: number;
}) {
  return (
    <ReAnimated.View entering={FadeInDown.delay(80 + index * 60).springify()} style={sc.card}>
      <View style={[sc.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </ReAnimated.View>
  );
}

const sc = StyleSheet.create({
  card:    { width: '47%', backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 16, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  iconWrap:{ width: 38, height: 38, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  value:   { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  label:   { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
});

// ── Jobs bar chart ────────────────────────────────────────────────────────────

function JobsBarChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const BAR_MAX = 80;

  return (
    <ReAnimated.View entering={FadeInDown.delay(200).springify()} style={bc.card}>
      <View style={bc.titleRow}>
        <Ionicons name="bar-chart-outline" size={16} color={Colors.textMuted} />
        <Text style={bc.title}>Jobs Completed</Text>
      </View>
      <View style={bc.chartRow}>
        {data.map((d, i) => {
          const barH   = Math.max((d.count / max) * BAR_MAX, d.count > 0 ? 6 : 2);
          const isLast = i === data.length - 1;
          return (
            <View key={d.date} style={bc.col}>
              <Text style={bc.countLabel}>{d.count > 0 ? d.count : ''}</Text>
              <View style={[bc.barTrack, { height: BAR_MAX }]}>
                <View style={[bc.bar, { height: barH, backgroundColor: isLast ? Colors.accent : Colors.accentLight }]} />
              </View>
              <Text style={bc.dayLabel}>
                {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Text>
            </View>
          );
        })}
      </View>
    </ReAnimated.View>
  );
}

const bc = StyleSheet.create({
  card:       { backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  title:      { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  chartRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col:        { flex: 1, alignItems: 'center', gap: 4 },
  countLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', height: 14 },
  barTrack:   { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar:        { width: '65%', borderRadius: 4 },
  dayLabel:   { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
});

// ── Recent reviews ────────────────────────────────────────────────────────────

function ReviewCard({ review, index }: { review: Review; index: number }) {
  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 50).springify()} style={rv.card}>
      <View style={rv.topRow}>
        <View style={rv.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <Ionicons key={n} name={n <= review.rating ? 'star' : 'star-outline'} size={13} color={Colors.warning} />
          ))}
        </View>
        <Text style={rv.customerName}>{anonymizeName(review.customerName)}</Text>
        <Text style={rv.date}>{formatReviewDate(review.date)}</Text>
      </View>
      {review.comment ? (
        <Text style={rv.comment} numberOfLines={3}>{review.comment}</Text>
      ) : null}
      {review.serviceName ? (
        <Text style={rv.service}>{review.serviceName}</Text>
      ) : null}
    </ReAnimated.View>
  );
}

const rv = StyleSheet.create({
  card:         { backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  starsRow:     { flexDirection: 'row', gap: 1 },
  customerName: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  date:         { fontSize: 11, color: Colors.textMuted },
  comment:      { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 6 },
  service:      { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
});

// ── Achievements ──────────────────────────────────────────────────────────────

function AchievementsSection({ unlocked }: { unlocked: string[] }) {
  return (
    <ReAnimated.View entering={FadeInDown.delay(240).springify()} style={ac.wrap}>
      <Text style={ac.sectionLabel}>Achievements</Text>
      <View style={ac.grid}>
        {ACHIEVEMENTS.map((a, i) => {
          const isUnlocked = unlocked.includes(a.id);
          return (
            <ReAnimated.View
              key={a.id}
              entering={FadeInDown.delay(260 + i * 40).springify()}
              style={[ac.badge, !isUnlocked && ac.badgeLocked]}
            >
              <View style={[ac.iconWrap, isUnlocked ? ac.iconWrapUnlocked : ac.iconWrapLocked]}>
                <Ionicons name={a.icon} size={22} color={isUnlocked ? Colors.warning : Colors.textMuted} />
              </View>
              <Text style={[ac.badgeLabel, !isUnlocked && ac.badgeLabelLocked]} numberOfLines={2}>{a.label}</Text>
              <Text style={ac.badgeDesc} numberOfLines={2}>{a.desc}</Text>
              {isUnlocked && (
                <View style={ac.checkWrap}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                </View>
              )}
            </ReAnimated.View>
          );
        })}
      </View>
    </ReAnimated.View>
  );
}

const ac = StyleSheet.create({
  wrap:             { gap: 12 },
  sectionLabel:     { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge:            { width: '47%', backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  badgeLocked:      { opacity: 0.45 },
  iconWrap:         { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  iconWrapUnlocked: { backgroundColor: Colors.warningBg },
  iconWrapLocked:   { backgroundColor: Colors.surfaceAlt },
  badgeLabel:       { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  badgeLabelLocked: { color: Colors.textMuted },
  badgeDesc:        { fontSize: 10, color: Colors.textMuted, textAlign: 'center', lineHeight: 14 },
  checkWrap:        { position: 'absolute', top: 8, right: 8 },
});

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={sl.label}>{title}</Text>;
}

const sl = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PerformanceScreen() {
  const { user } = useAuth();

  const [period,     setPeriod]     = useState<Period>('week');
  const [data,       setData]       = useState<PerformanceData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = { period };
      if (user?._id) params.staffId = user._id;
      const { data: res } = await axios.get<PerformanceData>('/api/staff/performance', { params });
      setData(res);
    } catch {
      setData({
        jobsCompleted:    0,
        avgJobDuration:   0,
        revenueGenerated: 0,
        streak:           0,
        avgRating:        0,
        totalRatings:     0,
        ratingBreakdown:  [],
        dailyJobs:        [],
        recentReviews:    [],
        achievements:     [],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, user?._id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ── */}
      <ReAnimated.View entering={FadeIn.duration(300)} style={s.header}>
        <Text style={s.title}>My Performance</Text>
        <PeriodToggle period={period} onChange={setPeriod} />
      </ReAnimated.View>

      {loading ? (
        <SkeletonScreen />
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
        >

          {/* ── Rating card ── */}
          {data && (
            <RatingCard
              avgRating={data.avgRating}
              totalRatings={data.totalRatings}
              breakdown={data.ratingBreakdown}
            />
          )}

          {/* ── Stats 2×2 grid ── */}
          {data && (
            <View style={s.statGrid}>
              <StatCard index={0} icon="briefcase-outline"  label="Jobs Completed"     value={String(data.jobsCompleted)}             color={Colors.accent}  />
              <StatCard index={1} icon="time-outline"       label="Avg Job Time"        value={formatDuration(data.avgJobDuration)}     color={Colors.warning} />
              <StatCard index={2} icon="cash-outline"       label="Revenue Generated"   value={formatCurrency(data.revenueGenerated)}   color={Colors.success} />
              <StatCard index={3} icon="flame-outline"      label="Day Streak"          value={data.streak > 0 ? `${data.streak}d` : '—'} color={Colors.error} />
            </View>
          )}

          {/* ── Jobs bar chart ── */}
          {data && data.dailyJobs.length > 0 && (
            <JobsBarChart data={data.dailyJobs} />
          )}

          {/* ── Recent reviews ── */}
          {data && data.recentReviews.length > 0 && (
            <View style={s.section}>
              <SectionLabel title="Recent Reviews" />
              {data.recentReviews.slice(0, 5).map((review, i) => (
                <ReviewCard key={review._id} review={review} index={i} />
              ))}
            </View>
          )}

          {/* ── Achievements ── */}
          {data && (
            <AchievementsSection unlocked={data.achievements} />
          )}

          {/* ── Zero state ── */}
          {data && data.jobsCompleted === 0 && (
            <ReAnimated.View entering={FadeIn.duration(300)} style={s.zeroCard}>
              <View style={s.zeroIconWrap}>
                <Ionicons name="analytics-outline" size={40} color={Colors.textMuted} />
              </View>
              <Text style={s.zeroTitle}>No data yet</Text>
              <Text style={s.zeroText}>Complete jobs and your stats will appear here.</Text>
            </ReAnimated.View>
          )}

        </ScrollView>
      )}

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },

  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: 100,
    gap: 14,
  },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  section: { gap: 10 },

  zeroCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  zeroIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  zeroTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  zeroText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
