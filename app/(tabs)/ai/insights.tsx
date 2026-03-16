// app/(tabs)/ai/insights.tsx — Demand Prediction
//
// Trigger: Admin taps "Load Insights"
// Sends to Claude: last 90 days of bookings grouped by day + hour
// Prompt: identify peak hours, slow periods, 3 staffing recommendations
// Display: recommendations card, peak-hour chips, slow-day chips
import { Ionicons }  from '@expo/vector-icons';
import axios         from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { router }    from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useClaudeAI } from '@/hooks/useClaudeAI';
import { Colors } from '@/constants/Colors';
import { IS_IOS, IS_ANDROID } from '@/utils/platform';
import { SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

type Recommendation = { title: string; detail: string };

type DemandResult = {
  peakHours:       string[];
  slowDays:        string[];
  recommendations: Recommendation[];
};

type DemandContext = {
  period:           number;
  totalBookings:    number;
  bookingsByDayHour: { slot: string; count: number }[];
};

// ─── Recommendation card ──────────────────────────────────────────────────────

const REC_ICONS = ['person-add-outline', 'trending-up-outline', 'megaphone-outline'];
const REC_COLORS = [Colors.accent, Colors.accent, Colors.success];
const REC_BG     = [Colors.accentMuted, Colors.accentMuted, Colors.successBg];

function RecCard({ rec, index }: { rec: Recommendation; index: number }) {
  const color = REC_COLORS[index % REC_COLORS.length];
  const bg    = REC_BG[index % REC_BG.length];
  const icon  = REC_ICONS[index % REC_ICONS.length];

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(350)} style={[rc.card]}>
      <View style={[rc.iconCircle, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={rc.body}>
        <Text style={[rc.title, { color }]}>{rec.title}</Text>
        <Text style={rc.detail}>{rec.detail}</Text>
        <View style={rc.footer}>
          <View style={[rc.confidenceBadge, { backgroundColor: bg }]}>
            <Ionicons name="checkmark-circle" size={11} color={color} />
            <Text style={[rc.confidenceText, { color }]}>AI Recommended</Text>
          </View>
          <Pressable
            style={rc.applyBtn}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={rc.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Hour chip ────────────────────────────────────────────────────────────────

function HourChip({ time, color, bg }: { time: string; color: string; bg: string }) {
  return (
    <View style={[chip.pill, { backgroundColor: bg }]}>
      <Ionicons name="time-outline" size={12} color={color} />
      <Text style={[chip.text, { color }]}>{time}</Text>
    </View>
  );
}

// ─── Day chip ─────────────────────────────────────────────────────────────────

function DayChip({ day, color, bg }: { day: string; color: string; bg: string }) {
  return (
    <View style={[chip.pill, { backgroundColor: bg }]}>
      <Ionicons name="calendar-outline" size={12} color={color} />
      <Text style={[chip.text, { color }]}>{day}</Text>
    </View>
  );
}

// ─── Top slots bar chart (mini) ───────────────────────────────────────────────

function TopSlotsChart({ slots }: { slots: { slot: string; count: number }[] }) {
  const top5   = slots.slice(0, 5);
  const maxVal = Math.max(...top5.map(s => s.count), 1);

  return (
    <View style={ch.wrap}>
      <Text style={ch.title}>Top Booking Slots (last 90 days)</Text>
      {top5.map((s, i) => (
        <View key={i} style={ch.row}>
          <Text style={ch.label} numberOfLines={1}>{s.slot}</Text>
          <View style={ch.barTrack}>
            <View style={[ch.bar, { width: `${(s.count / maxVal) * 100}%` as any }]} />
          </View>
          <Text style={ch.count}>{s.count}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DemandInsightsScreen() {
  const [ctx,        setCtx]        = useState<DemandContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [ctxError,   setCtxError]   = useState<string | null>(null);

  const { ask, loading, result, error, reset } = useClaudeAI<DemandResult>();

  // ── Load context + ask Claude in one tap ─────────────────────────────────

  async function loadInsights() {
    setLoadingCtx(true);
    setCtxError(null);
    setCtx(null);
    reset();

    try {
      const { data } = await axios.get<DemandContext>('/ai/claude/demand-context');
      setCtx(data);

      if (data.totalBookings === 0) {
        setCtxError('Not enough booking data yet. Need at least a few confirmed bookings.');
        setLoadingCtx(false);
        return;
      }

      // Immediately pass context to Claude
      await ask('demand_prediction', {
        period:           data.period,
        totalBookings:    data.totalBookings,
        bookingsByDayHour: data.bookingsByDayHour,
      });
    } catch (err: any) {
      setCtxError(err.response?.data?.error ?? 'Failed to load demand data.');
    } finally {
      setLoadingCtx(false);
    }
  }

  const isLoading = loadingCtx || loading;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── ScreenHeader ── */}
      <Animated.View entering={FadeIn.duration(300)} style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={8}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>AI Insights</Text>
          <Text style={s.headerSub}>Data-driven recommendations</Text>
        </View>
        <View style={s.claudeBadge}>
          <Text style={s.claudeInitial}>C</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero metric card ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            {ctx && !isLoading ? (
              <>
                <Text style={s.heroMetric}>{ctx.totalBookings}</Text>
                <Text style={s.heroLabel}>Bookings Analysed</Text>
                <View style={s.heroTrend}>
                  <Ionicons name="trending-up" size={14} color={Colors.white} />
                  <Text style={s.heroTrendText}>{ctx.period}-day window</Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.heroPlaceholderIcon}>
                  <Ionicons name="analytics-outline" size={36} color="rgba(255,255,255,0.7)" />
                </View>
                <Text style={s.heroPlaceholderText}>Tap "Load Insights" to analyse your data</Text>
              </>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── Description ── */}
        <Animated.View entering={FadeInDown.delay(140).duration(350)} style={s.descCard}>
          <Text style={s.descText}>
            Claude analyses your last 90 days of booking data to surface peak hours,
            underused time slots, and 3 concrete staffing recommendations.
          </Text>
        </Animated.View>

        {/* ── Context summary pill ── */}
        {ctx && !isLoading && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.ctxPill}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={s.ctxPillText}>
              {ctx.totalBookings} bookings analysed · {ctx.period}-day window
            </Text>
          </Animated.View>
        )}

        {/* ── Load / Refresh button ── */}
        {!result && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)}>
            <Pressable
              style={[s.loadBtn, isLoading && { opacity: 0.6 }]}
              onPress={loadInsights}
              disabled={isLoading}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator color={Colors.white} size="small" />
                  <Text style={s.loadBtnText}>
                    {loadingCtx ? 'Fetching booking data…' : 'Claude is analysing…'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={Colors.white} />
                  <Text style={s.loadBtnText}>Load Insights</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}

        {/* ── Error ── */}
        {(ctxError || error) && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.errCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={s.errText}>{ctxError ?? error}</Text>
          </Animated.View>
        )}

        {/* ── Results ── */}
        {result && (
          <>
            {/* Refresh button */}
            <Pressable
              style={s.refreshBtn}
              onPress={loadInsights}
              disabled={isLoading}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              <Ionicons name="refresh-outline" size={15} color={Colors.accent} />
              <Text style={s.refreshText}>Refresh</Text>
            </Pressable>

            {/* Top slots mini-chart */}
            {ctx && ctx.bookingsByDayHour.length > 0 && (
              <TopSlotsChart slots={ctx.bookingsByDayHour} />
            )}

            {/* Peak hours */}
            {result.peakHours.length > 0 && (
              <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionIconWrap}>
                    <Ionicons name="flame-outline" size={14} color={Colors.error} />
                  </View>
                  <Text style={s.sectionTitle}>Peak Hours</Text>
                </View>
                <View style={s.chipRow}>
                  {result.peakHours.map((h, i) => (
                    <HourChip key={i} time={h} color={Colors.error} bg={Colors.errorBg} />
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Slow days */}
            {result.slowDays.length > 0 && (
              <Animated.View entering={FadeInDown.delay(160).duration(350)} style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionIconWrap}>
                    <Ionicons name="moon-outline" size={14} color={Colors.textSecondary} />
                  </View>
                  <Text style={s.sectionTitle}>Slowest Days</Text>
                </View>
                <View style={s.chipRow}>
                  {result.slowDays.map((d, i) => (
                    <DayChip key={i} day={d} color={Colors.textSecondary} bg={Colors.surfaceAlt} />
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Recommendations */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIconWrap, { backgroundColor: Colors.accentMuted }]}>
                  <Ionicons name="sparkles" size={14} color={Colors.accent} />
                </View>
                <Text style={s.claudeAttr}>Claude's Staffing Recommendations</Text>
              </View>
              <View style={s.recList}>
                {result.recommendations.map((r, i) => (
                  <RecCard key={i} rec={r} index={i} />
                ))}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHADOW = IS_IOS
  ? { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }
  : IS_ANDROID ? { elevation: 2 } : {};

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingBottom: 100, gap: 14 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerTitle:  { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
  headerSub:    { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  claudeBadge:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.warning, alignItems: 'center', justifyContent: 'center' },
  claudeInitial:{ color: Colors.white, fontWeight: '900', fontSize: 16 },

  // Hero card
  heroCard: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    minHeight: 130,
    justifyContent: 'center',
    gap: 6,
  },
  heroMetric:          { fontSize: 40, fontWeight: '800', color: Colors.white },
  heroLabel:           { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  heroTrend:           { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heroTrendText:       { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  heroPlaceholderIcon: { marginBottom: 8 },
  heroPlaceholderText: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  descCard: { backgroundColor: Colors.accentMuted, borderRadius: 14, padding: 14, marginHorizontal: SCREEN_PADDING },
  descText: { fontSize: 13, color: Colors.primaryDark, lineHeight: 20 },

  ctxPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.successBg, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6,
    marginHorizontal: SCREEN_PADDING,
  },
  ctxPillText: { fontSize: 12, color: Colors.successText, fontWeight: '600' },

  loadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16,
    marginHorizontal: SCREEN_PADDING,
    overflow: 'hidden',
    ...(IS_IOS ? { shadowColor: Colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } } : IS_ANDROID ? { elevation: 6 } : {}),
  },
  loadBtnText: { color: Colors.white, fontWeight: '800', fontSize: 16 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    backgroundColor: Colors.accentMuted, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
    marginHorizontal: SCREEN_PADDING, overflow: 'hidden',
  },
  refreshText: { fontSize: 13, color: Colors.accent, fontWeight: '700' },

  errCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.errorBg, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.errorBg,
    marginHorizontal: SCREEN_PADDING,
  },
  errText: { flex: 1, fontSize: 13, color: Colors.error },

  section: { gap: 10, paddingHorizontal: SCREEN_PADDING },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIconWrap: { width: 24, height: 24, borderRadius: 7, backgroundColor: Colors.errorBg, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  claudeAttr:    { fontSize: 14, fontWeight: '800', color: Colors.accent },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recList: { gap: 12 },
});

// ─── Recommendation card styles ───────────────────────────────────────────────

const rc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20,
    ...(IS_IOS
      ? { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }
      : IS_ANDROID ? { elevation: 2 } : {}),
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body:    { flex: 1, gap: 6 },
  title:   { fontSize: 16, fontWeight: '800' },
  detail:  { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  footer:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  confidenceText:  { fontSize: 10, fontWeight: '700' },
  applyBtn:        { borderRadius: 99, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  applyBtnText:    { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
});

// ─── Chip styles ──────────────────────────────────────────────────────────────

const chip = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
  },
  text: { fontSize: 12, fontWeight: '700' },
});

// ─── Top-slots chart styles ───────────────────────────────────────────────────

const SHADOW_CARD = IS_IOS
  ? { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }
  : IS_ANDROID ? { elevation: 2 } : {};

const ch = StyleSheet.create({
  wrap:  { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 10, ...SHADOW_CARD, marginHorizontal: SCREEN_PADDING },
  title: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 120, fontSize: 12, color: Colors.textSecondary },
  barTrack: { flex: 1, height: 10, backgroundColor: Colors.surfaceAlt, borderRadius: 99, overflow: 'hidden' },
  bar:      { height: '100%', backgroundColor: Colors.accent, borderRadius: 99 },
  count:    { width: 28, fontSize: 12, color: Colors.textSecondary, fontWeight: '700', textAlign: 'right' },
});
