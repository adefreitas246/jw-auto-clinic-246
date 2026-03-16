// app/(customer)/book/datetime.tsx — Step 3: Pick date + available time slot
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { Colors } from '@/constants/Colors';
import { useBooking } from '@/context/BookingContext';
import { TimeSlot } from '@/types/booking';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function buildCalendarDays(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BookDateTimeStep() {
  const { draft, setDateTime } = useBooking();

  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const [selectedDate, setSelectedDate] = useState(draft.appointmentDate);
  const [selectedTime, setSelectedTime] = useState(draft.appointmentTime);

  const [slots,   setSlots]   = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => buildCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const fetchSlots = useCallback(async (date: string) => {
    setSlots([]);
    setLoading(true);
    try {
      const res = await axios.get<TimeSlot[]>('/api/bookings/availability', {
        params: { date, duration: draft.durationMinutes || 30 },
      });
      setSlots(res.data);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [draft.durationMinutes]);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  const handleDayPress = (day: number) => {
    const d = isoDate(calYear, calMonth, day);
    if (d < todayStr) return;
    Haptics.selectionAsync();
    setSelectedDate(d);
    setSelectedTime('');
  };

  const canContinue = !!selectedDate && !!selectedTime;

  const handleNext = () => {
    setDateTime(selectedDate, selectedTime);
    router.push('/(customer)/book/location');
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={3} />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Calendar card ── */}
        <View style={s.calCard}>
          {/* Month nav */}
          <View style={s.calHeader}>
            <Pressable
              onPress={prevMonth}
              style={s.calNavBtn}
              hitSlop={12}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.accent} />
            </Pressable>
            <Text style={s.calTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
            <Pressable
              onPress={nextMonth}
              style={s.calNavBtn}
              hitSlop={12}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
            </Pressable>
          </View>

          {/* Day-of-week labels */}
          <View style={s.calDOW}>
            {DAY_NAMES.map(d => (
              <View key={d} style={s.calDOWCell}>
                <Text style={s.calDOWText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={s.calDivider} />

          {/* Day grid */}
          <View style={s.calGrid}>
            {days.map((day, i) => {
              if (day === null) return <View key={`null-${i}`} style={s.calDayCell} />;
              const iso    = isoDate(calYear, calMonth, day);
              const past   = iso < todayStr;
              const sel    = iso === selectedDate;
              const isToday = iso === todayStr;
              return (
                <Pressable
                  key={iso}
                  style={[
                    s.calDayCell,
                    isToday && !sel && s.calDayToday,
                    sel && s.calDaySel,
                    past && s.calDayPast,
                  ]}
                  onPress={() => handleDayPress(day)}
                  disabled={past}
                  android_ripple={{ color: Colors.accent + '12', borderless: false }}
                >
                  <Text style={[
                    s.calDayText,
                    isToday && !sel && s.calDayTextToday,
                    sel && s.calDayTextSel,
                    past && s.calDayTextPast,
                  ]}>
                    {day}
                  </Text>
                  {isToday && !sel && <View style={s.todayDot} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Time slots ── */}
        {selectedDate ? (
          <View style={s.slotsSection}>
            <View style={s.slotsTitleRow}>
              <Ionicons name="time-outline" size={16} color={Colors.accent} />
              <Text style={s.slotsTitle}>
                Available times for{' '}
                <Text style={s.slotsTitleDate}>{formatDate(selectedDate)}</Text>
              </Text>
            </View>

            {loading ? (
              <View style={s.slotsLoading}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={s.slotsLoadingText}>Checking availability…</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={s.noSlotsWrap}>
                <Ionicons name="calendar-outline" size={32} color={Colors.border} />
                <Text style={s.noSlotsText}>No availability on this date.</Text>
                <Text style={s.noSlotsHint}>Try selecting a different day.</Text>
              </View>
            ) : (
              <View style={s.slotsGrid}>
                {slots.map(slot => {
                  const isSel = slot.time === selectedTime;
                  return (
                    <Pressable
                      key={slot.time}
                      style={[
                        s.slotBtn,
                        !slot.available && s.slotBtnUnavail,
                        isSel && s.slotBtnSel,
                      ]}
                      onPress={() => {
                        if (slot.available) {
                          Haptics.selectionAsync();
                          setSelectedTime(slot.time);
                        }
                      }}
                      disabled={!slot.available}
                      android_ripple={{ color: Colors.accent + '12', borderless: false }}
                    >
                      <Text style={[
                        s.slotText,
                        !slot.available && s.slotTextUnavail,
                        isSel && s.slotTextSel,
                      ]}>
                        {slot.time}
                      </Text>
                      {isSel && (
                        <View style={s.slotCheckDot} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={s.pickDateHintWrap}>
            <Ionicons name="calendar-outline" size={24} color={Colors.textMuted} />
            <Text style={s.pickDateHint}>Select a date to see available times</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {canContinue && (
          <View style={s.footerSummaryWrap}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={s.footerSummary}>
              {formatDate(selectedDate)} at {selectedTime}
            </Text>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [
            s.nextBtn,
            !canContinue && s.nextBtnOff,
            pressed && canContinue && { opacity: 0.88 },
          ]}
          onPress={handleNext}
          disabled={!canContinue}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          <Text style={s.nextBtnText}>Next — Location</Text>
          <Ionicons name="arrow-forward" size={17} color={Colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const CELL = 42;

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 120 },

  // Calendar card
  calCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    ...cardShadow,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  calDOW:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  calDOWCell: { width: CELL, alignItems: 'center' },
  calDOWText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  calDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 8, opacity: 0.5 },
  calGrid:  { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL / 2,
    marginBottom: 2,
  },
  calDaySel:   { backgroundColor: Colors.accent },
  calDayToday: { backgroundColor: Colors.accentMuted },
  calDayPast:  { opacity: 0.25 },
  calDayText:      { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  calDayTextSel:   { color: Colors.white, fontWeight: '700' },
  calDayTextToday: { color: Colors.accent, fontWeight: '700' },
  calDayTextPast:  { color: Colors.textMuted },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    position: 'absolute',
    bottom: 4,
  },

  // Slots section
  slotsSection: { marginBottom: 20 },
  slotsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  slotsTitle:    { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  slotsTitleDate: { color: Colors.accent, fontWeight: '700' },
  slotsLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  slotsLoadingText: { fontSize: 13, color: Colors.textMuted },
  noSlotsWrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noSlotsText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  noSlotsHint: { fontSize: 13, color: Colors.textMuted },
  slotsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    ...cardShadow,
  },
  slotBtnSel:      { backgroundColor: Colors.accent, borderColor: Colors.accent },
  slotBtnUnavail:  { backgroundColor: Colors.background, borderColor: Colors.background, opacity: 0.5 },
  slotText:        { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  slotTextSel:     { color: Colors.white },
  slotTextUnavail: { color: Colors.textMuted },
  slotCheckDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.white,
    marginTop: 3,
  },

  pickDateHintWrap: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  pickDateHint:     { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 14,
    paddingBottom: IS_IOS ? 32 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 8,
    ...(IS_IOS
      ? { shadowColor: Colors.shadow, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } }
      : { elevation: 8 }),
  },
  footerSummaryWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerSummary: { fontSize: 13, color: Colors.success, fontWeight: '600' },
  nextBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnOff:  { opacity: 0.4 },
  nextBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
