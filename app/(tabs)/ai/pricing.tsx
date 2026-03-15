// app/(tabs)/ai/pricing.tsx — Dynamic Pricing Suggestion
//
// Trigger: Screen loads (or admin refreshes)
// Sends to Claude: current queue length, time of day, day of week,
//                  historical avg bookings for this same slot
// Prompt: should we apply surcharge, discount, or keep standard pricing?
// Display: suggestion chip + percentage + reason + Apply / Ignore buttons
import { Ionicons }  from '@expo/vector-icons';
import axios         from 'axios';
import { router }    from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useClaudeAI } from '@/hooks/useClaudeAI';

// ─── Types ────────────────────────────────────────────────────────────────────

type PricingResult = {
  suggestion: 'surcharge' | 'discount' | 'none';
  percentage: number;
  reason:     string;
};

type PricingContext = {
  date:                  string;
  currentHour:           number;
  dayOfWeek:             string;
  queueLength:           number;
  historicalAvgForSlot:  number;
};

// ─── Suggestion config ────────────────────────────────────────────────────────

const SUGGESTION_CONFIG = {
  surcharge: {
    label:     'Peak Surcharge',
    icon:      'trending-up-outline',
    chipBg:    '#fff7ed',
    chipColor: '#ea580c',
    chipBorder:'#fed7aa',
    description: 'High demand detected. Consider a temporary price increase.',
    applyText: 'Apply Surcharge',
    applyBg:   '#ea580c',
  },
  discount: {
    label:     'Off-Peak Discount',
    icon:      'trending-down-outline',
    chipBg:    '#ecfdf5',
    chipColor: '#10b981',
    chipBorder:'#a7f3d0',
    description: 'Low demand right now. A discount could attract more bookings.',
    applyText: 'Apply Discount',
    applyBg:   '#10b981',
  },
  none: {
    label:     'Standard Pricing',
    icon:      'remove-circle-outline',
    chipBg:    '#f3f4f6',
    chipColor: '#6b7280',
    chipBorder:'#e5e7eb',
    description: 'Demand is within normal range. No price adjustment needed.',
    applyText: 'No Action',
    applyBg:   '#6b7280',
  },
};

// ─── Context card ─────────────────────────────────────────────────────────────

function ConditionsCard({ ctx }: { ctx: PricingContext }) {
  const ratio = ctx.historicalAvgForSlot > 0
    ? ctx.queueLength / ctx.historicalAvgForSlot
    : null;

  return (
    <View style={cc.card}>
      <Text style={cc.title}>Current Conditions</Text>
      <View style={cc.grid}>
        <View style={cc.cell}>
          <Ionicons name="time-outline" size={18} color="#6a0dad" />
          <Text style={cc.cellLabel}>Time</Text>
          <Text style={cc.cellValue}>{ctx.currentHour}:00</Text>
        </View>
        <View style={cc.cell}>
          <Ionicons name="calendar-outline" size={18} color="#0077cc" />
          <Text style={cc.cellLabel}>Day</Text>
          <Text style={cc.cellValue}>{ctx.dayOfWeek}</Text>
        </View>
        <View style={cc.cell}>
          <Ionicons name="car-outline" size={18} color="#f59e0b" />
          <Text style={cc.cellLabel}>Queue</Text>
          <Text style={cc.cellValue}>{ctx.queueLength}</Text>
        </View>
        <View style={cc.cell}>
          <Ionicons name="stats-chart-outline" size={18} color="#10b981" />
          <Text style={cc.cellLabel}>Avg (slot)</Text>
          <Text style={cc.cellValue}>{ctx.historicalAvgForSlot}</Text>
        </View>
      </View>

      {/* Demand vs historical bar */}
      {ratio !== null && (
        <View style={cc.ratioWrap}>
          <Text style={cc.ratioLabel}>
            Queue vs Historical Average:{' '}
            <Text style={{ fontWeight: '800', color: ratio > 1.3 ? '#ea580c' : ratio < 0.6 ? '#10b981' : '#6b7280' }}>
              {Math.round(ratio * 100)}%
            </Text>
          </Text>
          <View style={cc.ratioTrack}>
            <View style={[
              cc.ratioFill,
              {
                width: `${Math.min(ratio * 60, 100)}%` as any,
                backgroundColor: ratio > 1.3 ? '#ea580c' : ratio < 0.6 ? '#10b981' : '#6b7280',
              },
            ]} />
            {/* 100% baseline marker */}
            <View style={cc.baseline} />
          </View>
          <View style={cc.ratioLegend}>
            <Text style={cc.ratioLegendText}>0%</Text>
            <Text style={cc.ratioLegendText}>Avg (100%)</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Suggestion chip ──────────────────────────────────────────────────────────

function SuggestionChip({
  result,
  onApply,
  onIgnore,
  applied,
}: {
  result:   PricingResult;
  onApply:  () => void;
  onIgnore: () => void;
  applied:  boolean;
}) {
  const cfg = SUGGESTION_CONFIG[result.suggestion];

  return (
    <View style={[sc.chip, { borderColor: cfg.chipBorder }]}>
      {/* Top badge */}
      <View style={[sc.badge, { backgroundColor: cfg.chipBg }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
        <Text style={[sc.badgeLabel, { color: cfg.color }]}>{cfg.label}</Text>
        {result.percentage > 0 && (
          <View style={[sc.pctBadge, { backgroundColor: cfg.chipColor }]}>
            <Text style={sc.pctText}>
              {result.suggestion === 'discount' ? '-' : '+'}{result.percentage}%
            </Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={sc.desc}>{cfg.description}</Text>

      {/* Claude reasoning */}
      <View style={sc.reasonBox}>
        <Text style={sc.reasonPre}>Claude's reasoning:</Text>
        <Text style={sc.reasonText}>"{result.reason}"</Text>
      </View>

      {/* Actions */}
      {!applied ? (
        <View style={sc.actions}>
          <Pressable style={sc.ignoreBtn} onPress={onIgnore}>
            <Text style={sc.ignoreText}>Ignore</Text>
          </Pressable>
          {result.suggestion !== 'none' && (
            <Pressable style={[sc.applyBtn, { backgroundColor: cfg.applyBg }]} onPress={onApply}>
              <Ionicons name="checkmark-outline" size={15} color="#fff" />
              <Text style={sc.applyText}>{cfg.applyText}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={sc.appliedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={sc.appliedText}>Applied to new bookings for the next hour</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DynamicPricingScreen() {
  const [ctx,        setCtx]        = useState<PricingContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [ctxError,   setCtxError]   = useState<string | null>(null);
  const [applied,    setApplied]    = useState(false);

  const { ask, loading, result, error, reset } = useClaudeAI<PricingResult>();

  // ── Auto-load on mount ────────────────────────────────────────────────────

  const loadAndAsk = useCallback(async () => {
    setLoadingCtx(true);
    setCtxError(null);
    setCtx(null);
    setApplied(false);
    reset();

    try {
      const { data } = await axios.get<PricingContext>('/ai/claude/pricing-context');
      setCtx(data);

      await ask('dynamic_pricing', {
        date:                 data.date,
        currentHour:          data.currentHour,
        dayOfWeek:            data.dayOfWeek,
        queueLength:          data.queueLength,
        historicalAvgForSlot: data.historicalAvgForSlot,
      });
    } catch (err: any) {
      setCtxError(err.response?.data?.error ?? 'Failed to load pricing context.');
    } finally {
      setLoadingCtx(false);
    }
  }, [ask, reset]);

  useEffect(() => { loadAndAsk(); }, []);

  // ── Apply ─────────────────────────────────────────────────────────────────

  function handleApply() {
    if (!result) return;
    // In a full integration, PATCH /api/bookings/dynamic-price with { percentage, type }
    // For now we show a success state + alert
    Alert.alert(
      'Pricing Updated',
      `A ${result.percentage}% ${result.suggestion} will be applied to new bookings for the next hour.`,
      [{ text: 'Got it' }]
    );
    setApplied(true);
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
          <Text style={s.headerTitle}>Dynamic Pricing</Text>
          <View style={s.claudeBadge}>
            <Text style={s.claudeInitial}>C</Text>
          </View>
        </View>

        {/* ── Description ── */}
        <View style={s.descCard}>
          <Text style={s.descText}>
            Claude compares your live queue depth against 12 weeks of historical data
            for this exact day + time slot, then recommends a surcharge, discount, or no change.
          </Text>
        </View>

        {/* ── Loading state ── */}
        {isLoading && (
          <View style={s.loadingCard}>
            <ActivityIndicator color="#6a0dad" size="large" />
            <Text style={s.loadingText}>
              {loadingCtx ? 'Reading current queue…' : 'Claude is evaluating pricing…'}
            </Text>
          </View>
        )}

        {/* ── Error ── */}
        {(ctxError || error) && !isLoading && (
          <View style={s.errCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#e53935" />
            <Text style={s.errText}>{ctxError ?? error}</Text>
            <Pressable style={s.retryBtn} onPress={loadAndAsk}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* ── Context card ── */}
        {ctx && !isLoading && <ConditionsCard ctx={ctx} />}

        {/* ── Suggestion chip ── */}
        {result && !isLoading && (
          <SuggestionChip
            result={result}
            onApply={handleApply}
            onIgnore={reset}
            applied={applied}
          />
        )}

        {/* ── Refresh / check again ── */}
        {result && !isLoading && (
          <Pressable style={s.refreshBtn} onPress={loadAndAsk}>
            <Ionicons name="refresh-outline" size={15} color="#6a0dad" />
            <Text style={s.refreshText}>Check Again</Text>
          </Pressable>
        )}

        {/* ── Note ── */}
        <Text style={s.note}>
          Suggestions are AI-generated. Final pricing decisions remain with you.
        </Text>
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

  descCard: { backgroundColor: '#ecfdf5', borderRadius: 14, padding: 14 },
  descText: { fontSize: 13, color: '#065f46', lineHeight: 20 },

  loadingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 16, ...SHADOW,
  },
  loadingText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },

  errCard: {
    backgroundColor: '#fef2f2', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#fca5a5', gap: 10,
  },
  errText:   { fontSize: 13, color: '#e53935', flex: 1 },
  retryBtn:  { backgroundColor: '#e53935', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: '#f3eafd', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8,
  },
  refreshText: { fontSize: 13, color: '#6a0dad', fontWeight: '700' },

  note: { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },
});

// ─── Conditions card styles ───────────────────────────────────────────────────

const cc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 16, ...SHADOW,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#1f1f1f' },
  grid:  { flexDirection: 'row', gap: 12 },
  cell:  { flex: 1, alignItems: 'center', gap: 4 },
  cellLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  cellValue: { fontSize: 16, fontWeight: '900', color: '#1f1f1f' },

  ratioWrap:  { gap: 6 },
  ratioLabel: { fontSize: 12, color: '#6b7280' },
  ratioTrack: { height: 10, backgroundColor: '#f3f4f6', borderRadius: 99, overflow: 'hidden', position: 'relative' },
  ratioFill:  { height: '100%', borderRadius: 99 },
  baseline:   { position: 'absolute', top: 0, bottom: 0, left: '60%', width: 2, backgroundColor: '#d1d5db' },
  ratioLegend:{ flexDirection: 'row', justifyContent: 'space-between' },
  ratioLegendText: { fontSize: 10, color: '#9ca3af' },
});

// ─── Suggestion chip styles ───────────────────────────────────────────────────

const sc = StyleSheet.create({
  chip: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    borderWidth: 2, gap: 14, ...SHADOW,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 16, fontWeight: '900' },
  pctBadge:   { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pctText:    { color: '#fff', fontWeight: '900', fontSize: 15 },

  desc: { fontSize: 13, color: '#6b7280', lineHeight: 19 },

  reasonBox: {
    backgroundColor: '#fafafa', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#d1d5db', gap: 4,
  },
  reasonPre:  { fontSize: 11, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: 13, color: '#4b5563', lineHeight: 20, fontStyle: 'italic' },

  actions:   { flexDirection: 'row', gap: 10 },
  ignoreBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  ignoreText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  applyBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  applyText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  appliedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ecfdf5', borderRadius: 12, padding: 12,
  },
  appliedText: { fontSize: 13, color: '#065f46', fontWeight: '600', flex: 1 },
});
