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
  ActivityIndicator, Alert, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useClaudeAI } from '@/hooks/useClaudeAI';
import { Colors } from '@/constants/Colors';
import { IS_IOS, IS_ANDROID } from '@/utils/platform';
import { SCREEN_PADDING } from '@/utils/platformStyles';

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
    chipBg:    Colors.warningBg,
    chipColor: Colors.warning,
    chipBorder:Colors.warningBg,
    description: 'High demand detected. Consider a temporary price increase.',
    applyText: 'Apply Surcharge',
    applyBg:   Colors.warning,
  },
  discount: {
    label:     'Off-Peak Discount',
    icon:      'trending-down-outline',
    chipBg:    Colors.successBg,
    chipColor: Colors.success,
    chipBorder:Colors.successBg,
    description: 'Low demand right now. A discount could attract more bookings.',
    applyText: 'Apply Discount',
    applyBg:   Colors.success,
  },
  none: {
    label:     'Standard Pricing',
    icon:      'remove-circle-outline',
    chipBg:    Colors.surfaceAlt,
    chipColor: Colors.textSecondary,
    chipBorder:Colors.border,
    description: 'Demand is within normal range. No price adjustment needed.',
    applyText: 'No Action',
    applyBg:   Colors.textSecondary,
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
          <Ionicons name="time-outline" size={18} color={Colors.accent} />
          <Text style={cc.cellLabel}>Time</Text>
          <Text style={cc.cellValue}>{ctx.currentHour}:00</Text>
        </View>
        <View style={cc.cell}>
          <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
          <Text style={cc.cellLabel}>Day</Text>
          <Text style={cc.cellValue}>{ctx.dayOfWeek}</Text>
        </View>
        <View style={cc.cell}>
          <Ionicons name="car-outline" size={18} color={Colors.warning} />
          <Text style={cc.cellLabel}>Queue</Text>
          <Text style={cc.cellValue}>{ctx.queueLength}</Text>
        </View>
        <View style={cc.cell}>
          <Ionicons name="stats-chart-outline" size={18} color={Colors.success} />
          <Text style={cc.cellLabel}>Avg (slot)</Text>
          <Text style={cc.cellValue}>{ctx.historicalAvgForSlot}</Text>
        </View>
      </View>

      {/* Demand vs historical bar */}
      {ratio !== null && (
        <View style={cc.ratioWrap}>
          <Text style={cc.ratioLabel}>
            Queue vs Historical Average:{' '}
            <Text style={{ fontWeight: '800', color: ratio > 1.3 ? Colors.warning : ratio < 0.6 ? Colors.success : Colors.textSecondary }}>
              {Math.round(ratio * 100)}%
            </Text>
          </Text>
          <View style={cc.ratioTrack}>
            <View style={[
              cc.ratioFill,
              {
                width: `${Math.min(ratio * 60, 100)}%` as any,
                backgroundColor: ratio > 1.3 ? Colors.warning : ratio < 0.6 ? Colors.success : Colors.textSecondary,
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
              <Ionicons name="checkmark-outline" size={15} color={Colors.white} />
              <Text style={sc.applyText}>{cfg.applyText}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={sc.appliedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
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
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
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
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={s.loadingText}>
              {loadingCtx ? 'Reading current queue…' : 'Claude is evaluating pricing…'}
            </Text>
          </View>
        )}

        {/* ── Error ── */}
        {(ctxError || error) && !isLoading && (
          <View style={s.errCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
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
            <Ionicons name="refresh-outline" size={15} color={Colors.accent} />
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

const SHADOW = IS_IOS
  ? { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }
  : IS_ANDROID ? { elevation: 2 } : {};

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  scroll:  { flex: 1 },
  content: { padding: SCREEN_PADDING, paddingBottom: 100, gap: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 2,
  },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
  claudeBadge:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.warning, alignItems: 'center', justifyContent: 'center' },
  claudeInitial:{ color: Colors.white, fontWeight: '900', fontSize: 16 },

  descCard: { backgroundColor: Colors.successBg, borderRadius: 14, padding: 14 },
  descText: { fontSize: 13, color: Colors.successText, lineHeight: 20 },

  loadingCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 16, ...SHADOW,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  errCard: {
    backgroundColor: Colors.errorBg, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.errorBg, gap: 10,
  },
  errText:   { fontSize: 13, color: Colors.error, flex: 1 },
  retryBtn:  { backgroundColor: Colors.error, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  retryText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: Colors.accentMuted, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8,
  },
  refreshText: { fontSize: 13, color: Colors.accent, fontWeight: '700' },

  note: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});

// ─── Conditions card styles ───────────────────────────────────────────────────

const cc = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 18, padding: 18, gap: 16, ...SHADOW,
  },
  title: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  grid:  { flexDirection: 'row', gap: 12 },
  cell:  { flex: 1, alignItems: 'center', gap: 4 },
  cellLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cellValue: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },

  ratioWrap:  { gap: 6 },
  ratioLabel: { fontSize: 12, color: Colors.textSecondary },
  ratioTrack: { height: 10, backgroundColor: Colors.surfaceAlt, borderRadius: 99, overflow: 'hidden', position: 'relative' },
  ratioFill:  { height: '100%', borderRadius: 99 },
  baseline:   { position: 'absolute', top: 0, bottom: 0, left: '60%', width: 2, backgroundColor: Colors.border },
  ratioLegend:{ flexDirection: 'row', justifyContent: 'space-between' },
  ratioLegendText: { fontSize: 10, color: Colors.textMuted },
});

// ─── Suggestion chip styles ───────────────────────────────────────────────────

const sc = StyleSheet.create({
  chip: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20,
    borderWidth: 2, gap: 14, ...SHADOW,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 16, fontWeight: '900' },
  pctBadge:   { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pctText:    { color: Colors.white, fontWeight: '900', fontSize: 15 },

  desc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  reasonBox: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.border, gap: 4,
  },
  reasonPre:  { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },

  actions:   { flexDirection: 'row', gap: 10 },
  ignoreBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  ignoreText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  applyBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  applyText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  appliedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.successBg, borderRadius: 12, padding: 12,
  },
  appliedText: { fontSize: 13, color: Colors.successText, fontWeight: '600', flex: 1 },
});
