// app/(tabs)/performance.tsx — Staff Performance Screen
// Shows the logged-in staff member's stats: jobs, ratings, revenue,
// on-time %, and a 7-day earnings sparkline.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import axios from 'axios';

import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { ScreenHeader } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all';

interface PerformanceData {
  jobsCompleted:   number;
  jobsAssigned:    number;
  avgRating:       number;
  totalRatings:    number;
  revenueGenerated: number;
  onTimePct:       number;      // 0–100
  avgJobDuration:  number;      // minutes
  dailyEarnings:   { date: string; amount: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

function ratingColor(r: number): string {
  if (r >= 4.5) return Colors.success;
  if (r >= 3.5) return Colors.warning;
  return Colors.error;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: { date: string; amount: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.amount), 1);
  const BAR_MAX_HEIGHT = 48;

  return (
    <View style={sp.wrap}>
      {data.map((d, i) => {
        const pct = d.amount / max;
        const height = Math.max(pct * BAR_MAX_HEIGHT, 4);
        const isToday = i === data.length - 1;
        return (
          <View key={d.date} style={sp.col}>
            <View style={[sp.barTrack, { height: BAR_MAX_HEIGHT }]}>
              <View
                style={[
                  sp.bar,
                  { height, backgroundColor: isToday ? Colors.accent : Colors.accentLight },
                ]}
              />
            </View>
            <Text style={sp.label}>
              {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const sp = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 },
  col:      { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar:      { width: '70%', borderRadius: borderRadius.sm },
  label:    { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
});

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color = Colors.accent,
  index = 0,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  index?: number;
}) {
  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 80).springify()} style={[pf.statCard, cardShadow]}>
      <View style={[pf.statIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={pf.statValue}>{value}</Text>
      <Text style={pf.statLabel}>{label}</Text>
      {sub ? <Text style={pf.statSub}>{sub}</Text> : null}
    </ReAnimated.View>
  );
}

// ─── Rating stars ─────────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  return (
    <View style={pf.starsRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <Ionicons
          key={n}
          name={rating >= n ? 'star' : rating >= n - 0.5 ? 'star-half' : 'star-outline'}
          size={16}
          color={Colors.warning}
        />
      ))}
    </View>
  );
}

// ─── Period toggle ────────────────────────────────────────────────────────────

function PeriodPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[pf.periodPill, active && pf.periodPillActive]}
      onPress={onPress}
      android_ripple={{ color: Colors.accent + '20', borderless: false }}
    >
      <Text style={[pf.periodLabel, active && pf.periodLabelActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

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
      const { data: res } = await axios.get<PerformanceData>('/api/performance', { params });
      setData(res);
    } catch {
      // Fallback — show zeroed-out state on error
      setData({
        jobsCompleted:    0,
        jobsAssigned:     0,
        avgRating:        0,
        totalRatings:     0,
        revenueGenerated: 0,
        onTimePct:        0,
        avgJobDuration:   0,
        dailyEarnings:    [],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const changePeriod = (p: Period) => {
    if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPeriod(p);
  };

  const completionPct = data
    ? data.jobsAssigned > 0
      ? Math.round((data.jobsCompleted / data.jobsAssigned) * 100)
      : 100
    : 0;

  return (
    <SafeAreaView style={pf.safe} edges={['top']}>
      <ScreenHeader
        title="My Performance"
        subtitle={user?.name ?? 'Staff'}
      />

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Period toggle */}
        <View style={pf.periodRow}>
          {(['week', 'month', 'all'] as Period[]).map(p => (
            <PeriodPill
              key={p}
              label={p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              active={period === p}
              onPress={() => changePeriod(p)}
            />
          ))}
        </View>

        {loading ? (
          <View style={pf.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : data ? (
          <ReAnimated.View entering={FadeIn.duration(300)}>
            {/* 2×2 stat grid */}
            <View style={pf.statGrid}>
              <StatCard
                index={0}
                icon="checkmark-circle-outline"
                label="Jobs Completed"
                value={String(data.jobsCompleted)}
                sub={`of ${data.jobsAssigned} assigned`}
                color={Colors.success}
              />
              <StatCard
                index={1}
                icon="cash-outline"
                label="Revenue"
                value={formatCurrency(data.revenueGenerated)}
                color={Colors.accent}
              />
              <StatCard
                index={2}
                icon="time-outline"
                label="On-Time"
                value={`${data.onTimePct}%`}
                color={data.onTimePct >= 80 ? Colors.success : Colors.warning}
              />
              <StatCard
                index={3}
                icon="speedometer-outline"
                label="Avg Duration"
                value={formatDuration(data.avgJobDuration)}
                color={Colors.info}
              />
            </View>

            {/* Completion bar */}
            <View style={pf.card}>
              <View style={pf.cardTitleRow}>
                <Ionicons name="bar-chart-outline" size={16} color={Colors.textMuted} />
                <Text style={pf.cardTitle}>Completion Rate</Text>
                <Text style={[pf.cardValue, { color: completionPct >= 80 ? Colors.success : Colors.warning }]}>
                  {completionPct}%
                </Text>
              </View>
              <View style={pf.progressTrack}>
                <View
                  style={[
                    pf.progressFill,
                    {
                      width: `${completionPct}%` as any,
                      backgroundColor: completionPct >= 80 ? Colors.success : Colors.warning,
                    },
                  ]}
                />
              </View>
              <Text style={pf.progressSub}>
                {data.jobsCompleted} completed · {data.jobsAssigned - data.jobsCompleted} remaining
              </Text>
            </View>

            {/* Rating card */}
            {data.totalRatings > 0 && (
              <View style={pf.card}>
                <View style={pf.cardTitleRow}>
                  <Ionicons name="star-outline" size={16} color={Colors.textMuted} />
                  <Text style={pf.cardTitle}>Customer Rating</Text>
                </View>
                <View style={pf.ratingHero}>
                  <Text style={[pf.ratingNum, { color: ratingColor(data.avgRating) }]}>
                    {data.avgRating.toFixed(1)}
                  </Text>
                  <View>
                    <RatingStars rating={data.avgRating} />
                    <Text style={pf.ratingCount}>{data.totalRatings} reviews</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Earnings sparkline */}
            {data.dailyEarnings.length > 0 && (
              <View style={pf.card}>
                <View style={pf.cardTitleRow}>
                  <Ionicons name="trending-up-outline" size={16} color={Colors.textMuted} />
                  <Text style={pf.cardTitle}>Daily Earnings</Text>
                  <Text style={pf.cardValue}>
                    {formatCurrency(data.dailyEarnings.reduce((s, d) => s + d.amount, 0))} total
                  </Text>
                </View>
                <Sparkline data={data.dailyEarnings} />
              </View>
            )}

            {/* Zero state */}
            {data.jobsCompleted === 0 && (
              <View style={pf.zeroCard}>
                <View style={pf.zeroIconWrap}>
                  <Ionicons name="analytics-outline" size={40} color={Colors.textMuted} />
                </View>
                <Text style={pf.zeroTitle}>No data yet</Text>
                <Text style={pf.zeroText}>
                  Complete some jobs and your stats will appear here.
                </Text>
              </View>
            )}
          </ReAnimated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pf = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  scroll:   { flex: 1 },
  content:  { padding: SCREEN_PADDING, gap: 14, paddingBottom: SCROLL_PADDING_BOTTOM },
  centered: { paddingVertical: 60, alignItems: 'center' },

  // Period toggle
  periodRow: {
    flexDirection: 'row', gap: 8, marginBottom: 2,
  },
  periodPill: {
    flex: 1, paddingVertical: 9, alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  periodPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  periodLabel:      { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  periodLabelActive:{ color: Colors.white },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%', backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg, padding: 16,
    alignItems: 'flex-start',
  },
  statIconWrap: {
    width: 38, height: 38, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  statSub:   { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  // Generic card
  card: {
    backgroundColor: Colors.surface, borderRadius: borderRadius.lg,
    padding: 16, ...cardShadow,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  cardTitle:    { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  cardValue:    { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  // Progress bar
  progressTrack: {
    height: 10, backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.full, overflow: 'hidden',
  },
  progressFill:  { height: '100%', borderRadius: borderRadius.full },
  progressSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 8 },

  // Rating
  ratingHero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ratingNum:  { fontSize: 48, fontWeight: '800' },
  starsRow:   { flexDirection: 'row', gap: 2, marginBottom: 4 },
  ratingCount:{ fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  // Zero state
  zeroCard: {
    backgroundColor: Colors.surface, borderRadius: borderRadius.lg,
    padding: 32, alignItems: 'center', ...cardShadow,
  },
  zeroIconWrap: {
    width: 80, height: 80, borderRadius: borderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  zeroTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  zeroText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
