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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

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
        <Animated.View entering={FadeIn.duration(300)}>
          {/* ── Calendar card ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <View style={s.calCard}>
              {/* Month nav */}
              <View style={s.calHeader}>
                <Pressable
                  onPress={prevMonth}
                  style={s.calNavBtn}
                  hitSlop={12}
                  android_ripple={{ color: Colors.accent + '20', borderless: false }}
                >
                  <Ionicons name="chevron-back" size={18} color={Colors.accent} />
                </Pressable>
                <Text style={s.calTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
                <Pressable
                  onPress={nextMonth}
                  style={s.calNavBtn}
                  hitSlop={12}
                  android_ripple={{ color: Colors.accent + '20', borderless: false }}
                >
                  <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
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
                      android_ripple={{ color: Colors.accent + '20', borderless: false }}
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
          </Animated.View>

          {/* ── Time slots ── */}
          {selectedDate ? (
            <Animated.View entering={FadeInDown.delay(160).duration(300)} style={s.slotsSection}>
              <View style={s.slotsTitleRow}>
                <View style={s.slotsIconCircle}>
                  <Ionicons name="time-outline" size={14} color={Colors.accent} />
                </View>
                <Text style={s.slotsTitle}>
                  Available for{' '}
                  <Text style={s.slotsTitleDate}>{formatDate(selectedDate)}</Text>
                </Text>
              </View>

              {loading ? (
                <View style={s.slotsLoading}>
                  <ActivityIndicator color={Colors.accent} size="small" />
                  <Text style={s.slotsLoadingText}>Checking availability…</Text>
                </View>
              ) : slots.length === 0 ? (
                <View style={s.noSlotsWrap}>
                  <View style={s.noSlotsIcon}>
                    <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
                  </View>
                  <Text style={s.noSlotsText}>No availability on this date.</Text>
                  <Text style={s.noSlotsHint}>Try selecting a different day.</Text>
                </View>
              ) : (
                <View style={s.slotsGrid}>
                  {slots.map((slot, idx) => {
                    const isSel = slot.time === selectedTime;
                    return (
                      <Animated.View
                        key={slot.time}
                        entering={FadeInDown.delay(idx * 40).duration(250)}
                      >
                        <Pressable
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
                          android_ripple={{ color: Colors.accent + '20', borderless: false }}
                        >
                          {isSel && (
                            <Ionicons name="checkmark-circle" size={12} color={Colors.white} style={s.slotCheckIcon} />
                          )}
                          <Text style={[
                            s.slotText,
                            !slot.available && s.slotTextUnavail,
                            isSel && s.slotTextSel,
                          ]}>
                            {slot.time}
                          </Text>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(160).duration(300)} style={s.pickDateHintWrap}>
              <View style={s.pickDateHintIcon}>
                <Ionicons name="calendar-outline" size={22} color={Colors.textMuted} />
              </View>
              <Text style={s.pickDateHint}>Select a date above to see available times</Text>
            </Animated.View>
          )}
        </Animated.View>
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
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
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
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 120 },

  // Calendar card
  calCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.xl ?? borderRadius.lg,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitle:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  calDOW:     { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  calDOWCell: { width: CELL, alignItems: 'center' },
  calDOWText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  calDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 10, opacity: 0.6 },
  calGrid:    { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL / 2,
    marginBottom: 4,
  },
  calDaySel:   { backgroundColor: Colors.accent },
  calDayToday: { backgroundColor: Colors.accentMuted },
  calDayPast:  { opacity: 0.25 },
  calDayText:      { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  calDayTextSel:   { color: Colors.white, fontWeight: '800' },
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
  slotsSection:  { marginBottom: 20 },
  slotsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  slotsIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsTitle:     { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  slotsTitleDate: { color: Colors.accent, fontWeight: '700' },
  slotsLoading:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  slotsLoadingText: { fontSize: 13, color: Colors.textMuted },
  noSlotsWrap:  { alignItems: 'center', paddingVertical: 28, gap: 8 },
  noSlotsIcon:  {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noSlotsText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  noSlotsHint: { fontSize: 13, color: Colors.textMuted },
  slotsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    ...cardShadow,
  },
  slotBtnSel:      { backgroundColor: Colors.accent, borderColor: Colors.accent },
  slotBtnUnavail:  { backgroundColor: Colors.background, borderColor: Colors.background, opacity: 0.45 },
  slotText:        { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  slotTextSel:     { color: Colors.white },
  slotTextUnavail: { color: Colors.textMuted },
  slotCheckIcon:   {},

  pickDateHintWrap: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  pickDateHintIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickDateHint:   { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },

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
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
    ...(IS_IOS
      ? { shadowColor: Colors.shadow, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } }
      : { elevation: 8 }),
  },
  footerSummaryWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerSummary:     { fontSize: 13, color: Colors.success, fontWeight: '600' },
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
