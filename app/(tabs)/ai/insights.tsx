// app/(tabs)/ai/insights.tsx — Demand Prediction
//
// Trigger: Admin taps "Load Insights"
// Sends to Claude: last 90 days of bookings grouped by day + hour
// Prompt: identify peak hours, slow periods, 3 staffing recommendations
// Display: recommendations card, peak-hour chips, slow-day chips
import { Ionicons }  from '@expo/vector-icons';
import axios         from 'axios';
import { router }    from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useClaudeAI } from '@/hooks/useClaudeAI';

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
const REC_COLORS = ['#6a0dad', '#0077cc', '#10b981'];
const REC_BG     = ['#f3eafd', '#e8f4fd', '#ecfdf5'];

function RecCard({ rec, index }: { rec: Recommendation; index: number }) {
  const color = REC_COLORS[index % REC_COLORS.length];
  const bg    = REC_BG[index % REC_BG.length];
  const icon  = REC_ICONS[index % REC_ICONS.length];

  return (
    <View style={[rc.card, { borderLeftColor: color }]}>
      <View style={[rc.numBadge, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={rc.body}>
        <Text style={[rc.title, { color }]}>{rec.title}</Text>
        <Text style={rc.detail}>{rec.detail}</Text>
      </View>
    </View>
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
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#1f1f1f" />
          </Pressable>
          <Text style={s.headerTitle}>Demand Insights</Text>
          <View style={s.claudeBadge}>
            <Text style={s.claudeInitial}>C</Text>
          </View>
        </View>

        {/* ── Description ── */}
        <View style={s.descCard}>
          <Text style={s.descText}>
            Claude analyses your last 90 days of booking data to surface peak hours,
            underused time slots, and 3 concrete staffing recommendations.
          </Text>
        </View>

        {/* ── Context summary pill ── */}
        {ctx && !isLoading && (
          <View style={s.ctxPill}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={s.ctxPillText}>
              {ctx.totalBookings} bookings analysed · {ctx.period}-day window
            </Text>
          </View>
        )}

        {/* ── Load / Refresh button ── */}
        {!result && (
          <Pressable
            style={[s.loadBtn, isLoading && { opacity: 0.6 }]}
            onPress={loadInsights}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.loadBtnText}>
                  {loadingCtx ? 'Fetching booking data…' : 'Claude is analysing…'}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.loadBtnText}>✨  Load Insights</Text>
              </>
            )}
          </Pressable>
        )}

        {/* ── Error ── */}
        {(ctxError || error) && (
          <View style={s.errCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#e53935" />
            <Text style={s.errText}>{ctxError ?? error}</Text>
          </View>
        )}

        {/* ── Results ── */}
        {result && (
          <>
            {/* Refresh button */}
            <Pressable style={s.refreshBtn} onPress={loadInsights} disabled={isLoading}>
              <Ionicons name="refresh-outline" size={15} color="#6a0dad" />
              <Text style={s.refreshText}>Refresh</Text>
            </Pressable>

            {/* Top slots mini-chart */}
            {ctx && ctx.bookingsByDayHour.length > 0 && (
              <TopSlotsChart slots={ctx.bookingsByDayHour} />
            )}

            {/* Peak hours */}
            {result.peakHours.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="flame-outline" size={16} color="#e53935" />
                  <Text style={s.sectionTitle}>Peak Hours</Text>
                </View>
                <View style={s.chipRow}>
                  {result.peakHours.map((h, i) => (
                    <HourChip key={i} time={h} color="#e53935" bg="#fff1f2" />
                  ))}
                </View>
              </View>
            )}

            {/* Slow days */}
            {result.slowDays.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="moon-outline" size={16} color="#6b7280" />
                  <Text style={s.sectionTitle}>Slowest Days</Text>
                </View>
                <View style={s.chipRow}>
                  {result.slowDays.map((d, i) => (
                    <DayChip key={i} day={d} color="#6b7280" bg="#f3f4f6" />
                  ))}
                </View>
              </View>
            )}

            {/* Recommendations */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.claudeAttr}>✨ Claude's Staffing Recommendations</Text>
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

const SHADOW = Platform.select({
  ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 2,
  },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '900', color: '#1f1f1f' },
  claudeBadge:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#cc5500', alignItems: 'center', justifyContent: 'center' },
  claudeInitial:{ color: '#fff', fontWeight: '900', fontSize: 16 },

  descCard: { backgroundColor: '#e8f4fd', borderRadius: 14, padding: 14 },
  descText: { fontSize: 13, color: '#0c4a6e', lineHeight: 20 },

  ctxPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6,
  },
  ctxPillText: { fontSize: 12, color: '#065f46', fontWeight: '600' },

  loadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#0077cc', borderRadius: 16, paddingVertical: 16,
    ...Platform.select({
      ios:     { shadowColor: '#0077cc', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  loadBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    backgroundColor: '#f3eafd', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
  },
  refreshText: { fontSize: 13, color: '#6a0dad', fontWeight: '700' },

  errCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#fca5a5',
  },
  errText: { flex: 1, fontSize: 13, color: '#e53935' },

  section:       { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: '#1f1f1f' },
  claudeAttr:    { fontSize: 14, fontWeight: '800', color: '#6a0dad' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recList: { gap: 12 },
});

// ─── Recommendation card styles ───────────────────────────────────────────────

const rc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderLeftWidth: 4, ...SHADOW,
  },
  numBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body:     { flex: 1, gap: 4 },
  title:    { fontSize: 14, fontWeight: '800' },
  detail:   { fontSize: 13, color: '#4b5563', lineHeight: 19 },
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

const SHADOW_CARD = Platform.select({
  ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const ch = StyleSheet.create({
  wrap:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, ...SHADOW_CARD },
  title: { fontSize: 13, fontWeight: '700', color: '#1f1f1f', marginBottom: 4 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 120, fontSize: 12, color: '#6b7280' },
  barTrack: { flex: 1, height: 10, backgroundColor: '#f3f4f6', borderRadius: 99, overflow: 'hidden' },
  bar:      { height: '100%', backgroundColor: '#0077cc', borderRadius: 99 },
  count:    { width: 28, fontSize: 12, color: '#374151', fontWeight: '700', textAlign: 'right' },
});
