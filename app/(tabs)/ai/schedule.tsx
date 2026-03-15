// app/(tabs)/ai/schedule.tsx — Smart Scheduling Assistant
//
// Trigger: Admin picks a date + service duration
// Sends to Claude: staff availability, existing bookings, available slots
// Prompt: recommend optimal time + best technician to assign
// Display: recommendation banner with Accept / Dismiss
//
// On Accept → navigates to walkin screen with pre-filled time + staffId
import { Ionicons }  from '@expo/vector-icons';
import axios         from 'axios';
import { router }    from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Animated, Platform,
  Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useClaudeAI } from '@/hooks/useClaudeAI';

// ─── Types ────────────────────────────────────────────────────────────────────

type SchedulingResult = {
  recommendedTime: string;   // HH:MM
  staffId:         string | null;
  staffName:       string;
  reason:          string;
};

type ScheduleContext = {
  date:             string;
  duration:         number;
  availableSlots:   string[];
  existingBookings: { time: string; duration: number; service: string; staff: string }[];
  workers:          { id: string; name: string; role: string }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Recommendation banner ────────────────────────────────────────────────────

function RecommendationBanner({
  result,
  onAccept,
  onDismiss,
}: {
  result:    SchedulingResult;
  onAccept:  () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={b.banner}>
      {/* Header */}
      <View style={b.bannerHeader}>
        <View style={b.claudeIcon}>
          <Text style={b.claudeInitial}>C</Text>
        </View>
        <View>
          <Text style={b.bannerLabel}>Claude Recommends</Text>
          <Text style={b.bannerSub}>Based on current schedule & staff</Text>
        </View>
      </View>

      {/* Recommended time */}
      <View style={b.timeRow}>
        <View style={b.timePill}>
          <Ionicons name="time-outline" size={18} color="#6a0dad" />
          <Text style={b.timePillText}>{result.recommendedTime}</Text>
        </View>
        <View style={b.staffPill}>
          <Ionicons name="person-circle-outline" size={18} color="#0077cc" />
          <Text style={b.staffPillText}>{result.staffName}</Text>
        </View>
      </View>

      {/* Reason */}
      <View style={b.reasonBox}>
        <Text style={b.reasonText}>"{result.reason}"</Text>
      </View>

      {/* Actions */}
      <View style={b.actions}>
        <Pressable style={b.dismissBtn} onPress={onDismiss}>
          <Ionicons name="close" size={16} color="#6b7280" />
          <Text style={b.dismissText}>Dismiss</Text>
        </Pressable>
        <Pressable style={b.acceptBtn} onPress={onAccept}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          <Text style={b.acceptText}>Use This Slot</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Context summary ──────────────────────────────────────────────────────────

function ContextSummary({ ctx }: { ctx: ScheduleContext }) {
  return (
    <View style={s.ctxCard}>
      <Text style={s.ctxTitle}>Schedule Context Loaded</Text>
      <View style={s.ctxRow}>
        <Ionicons name="calendar-outline" size={14} color="#888" />
        <Text style={s.ctxText}>{ctx.date}</Text>
        <Ionicons name="time-outline" size={14} color="#888" style={{ marginLeft: 12 }} />
        <Text style={s.ctxText}>{ctx.duration} min service</Text>
      </View>
      <View style={s.ctxRow}>
        <Ionicons name="grid-outline" size={14} color="#888" />
        <Text style={s.ctxText}>
          {ctx.availableSlots.length} free slots · {ctx.existingBookings.length} booked
        </Text>
      </View>
      <View style={s.ctxRow}>
        <Ionicons name="people-outline" size={14} color="#888" />
        <Text style={s.ctxText}>{ctx.workers.length} staff members</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SmartScheduleScreen() {
  const [date,        setDate]        = useState(todayISO());
  const [duration,    setDuration]    = useState('60');
  const [ctx,         setCtx]         = useState<ScheduleContext | null>(null);
  const [loadingCtx,  setLoadingCtx]  = useState(false);
  const [ctxError,    setCtxError]    = useState<string | null>(null);
  const [accepted,    setAccepted]    = useState(false);

  const { ask, loading, result, error, reset } = useClaudeAI<SchedulingResult>();

  // ── Step 1: load context from backend ────────────────────────────────────

  async function loadContext() {
    setLoadingCtx(true);
    setCtxError(null);
    setCtx(null);
    reset();
    setAccepted(false);
    try {
      const dur = Math.max(15, parseInt(duration || '30', 10));
      const { data } = await axios.get<ScheduleContext>(
        `/ai/claude/schedule-context?date=${date}&duration=${dur}`
      );
      setCtx(data);
    } catch (err: any) {
      setCtxError(err.response?.data?.error ?? 'Failed to load schedule data.');
    } finally {
      setLoadingCtx(false);
    }
  }

  // ── Step 2: ask Claude ────────────────────────────────────────────────────

  async function askClaude() {
    if (!ctx) return;
    reset();
    setAccepted(false);
    await ask('smart_scheduling', {
      date:             ctx.date,
      duration:         ctx.duration,
      availableSlots:   ctx.availableSlots,
      existingBookings: ctx.existingBookings,
      workers:          ctx.workers,
    });
  }

  // ── Accept → navigate to walk-in with pre-filled values ──────────────────

  function handleAccept() {
    if (!result) return;
    setAccepted(true);
    router.push({
      pathname: '/(tabs)/walkin',
      params: {
        prefillTime:   result.recommendedTime,
        prefillDate:   date,
        prefillStaffId: result.staffId ?? '',
        prefillStaff:  result.staffName,
      },
    });
  }

  const canAsk = ctx && ctx.availableSlots.length > 0 && !loading;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#1f1f1f" />
          </Pressable>
          <Text style={s.headerTitle}>Smart Scheduling</Text>
          <View style={s.claudeBadge}>
            <Text style={s.claudeInitial}>C</Text>
          </View>
        </View>

        {/* ── Description ── */}
        <View style={s.descCard}>
          <Text style={s.descText}>
            Claude analyses your current schedule and staff availability to recommend the best booking slot and technician.
          </Text>
        </View>

        {/* ── Input form ── */}
        <View style={s.formCard}>
          <Text style={s.formLabel}>Appointment Date</Text>
          <TextInput
            style={s.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
          />

          <Text style={s.formLabel}>Service Duration (minutes)</Text>
          <TextInput
            style={s.input}
            value={duration}
            onChangeText={setDuration}
            placeholder="60"
            placeholderTextColor="#aaa"
            keyboardType="number-pad"
          />

          <Pressable
            style={[s.loadBtn, loadingCtx && { opacity: 0.6 }]}
            onPress={loadContext}
            disabled={loadingCtx}
          >
            {loadingCtx
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="download-outline" size={16} color="#fff" />
            }
            <Text style={s.loadBtnText}>
              {loadingCtx ? 'Loading Schedule…' : 'Load Schedule Data'}
            </Text>
          </Pressable>

          {ctxError && <Text style={s.errText}>{ctxError}</Text>}
        </View>

        {/* ── Context summary ── */}
        {ctx && <ContextSummary ctx={ctx} />}

        {/* No free slots warning */}
        {ctx && ctx.availableSlots.length === 0 && (
          <View style={s.warnCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#f59e0b" />
            <Text style={s.warnText}>
              No available slots found for this date and duration. Try a different date.
            </Text>
          </View>
        )}

        {/* ── Ask Claude button ── */}
        {ctx && ctx.availableSlots.length > 0 && !result && (
          <Pressable
            style={[s.askBtn, !canAsk && { opacity: 0.6 }]}
            onPress={askClaude}
            disabled={!canAsk}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.askBtnText}>Claude is analysing…</Text>
              </>
            ) : (
              <>
                <Text style={s.askBtnText}>✨  Get AI Recommendation</Text>
              </>
            )}
          </Pressable>
        )}

        {/* ── AI error ── */}
        {error && (
          <View style={s.errCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#e53935" />
            <Text style={s.errCardText}>{error}</Text>
          </View>
        )}

        {/* ── Recommendation banner ── */}
        {result && !accepted && (
          <RecommendationBanner
            result={result}
            onAccept={handleAccept}
            onDismiss={reset}
          />
        )}

        {accepted && (
          <View style={s.acceptedCard}>
            <Ionicons name="checkmark-circle" size={22} color="#10b981" />
            <Text style={s.acceptedText}>Slot accepted! Redirecting to booking…</Text>
          </View>
        )}
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

  descCard: {
    backgroundColor: '#f3eafd', borderRadius: 14, padding: 14,
  },
  descText: { fontSize: 13, color: '#4b1683', lineHeight: 20 },

  formCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 10, ...SHADOW,
  },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1,
    borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#1f1f1f',
  },

  loadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6a0dad', borderRadius: 12, paddingVertical: 13, marginTop: 4,
  },
  loadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  errText: { fontSize: 12, color: '#e53935', textAlign: 'center' },

  ctxCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 8, ...SHADOW,
  },
  ctxTitle: { fontSize: 13, fontWeight: '700', color: '#1f1f1f', marginBottom: 4 },
  ctxRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctxText:  { fontSize: 13, color: '#6b7280' },

  warnCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffbeb', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#fde68a',
  },
  warnText: { flex: 1, fontSize: 13, color: '#92400e' },

  askBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#6a0dad', borderRadius: 16, paddingVertical: 16,
    ...Platform.select({
      ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  askBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  errCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#fca5a5',
  },
  errCardText: { flex: 1, fontSize: 13, color: '#e53935' },

  acceptedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ecfdf5', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#6ee7b7',
  },
  acceptedText: { fontSize: 13, color: '#065f46', fontWeight: '600' },
});

// ─── Banner styles ────────────────────────────────────────────────────────────

const b = StyleSheet.create({
  banner: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 2,
    borderColor: '#d8b4fe',
    ...Platform.select({
      ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  bannerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  claudeIcon:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#cc5500', alignItems: 'center', justifyContent: 'center' },
  claudeInitial: { color: '#fff', fontWeight: '900', fontSize: 18 },
  bannerLabel:   { fontSize: 14, fontWeight: '800', color: '#1f1f1f' },
  bannerSub:     { fontSize: 11, color: '#9ca3af', marginTop: 1 },

  timeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f3eafd', borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  timePillText:  { fontSize: 20, fontWeight: '900', color: '#6a0dad', letterSpacing: 1 },
  staffPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e8f4fd', borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  staffPillText: { fontSize: 14, fontWeight: '700', color: '#0077cc' },

  reasonBox: {
    backgroundColor: '#fafafa', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#6a0dad',
  },
  reasonText: { fontSize: 13, color: '#4b5563', lineHeight: 20, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: 10 },
  dismissBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  dismissText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#6a0dad',
  },
  acceptText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
