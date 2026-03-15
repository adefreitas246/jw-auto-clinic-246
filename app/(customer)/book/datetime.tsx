// app/(customer)/book/datetime.tsx — Step 3: Pick date + available time slot
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { useBooking } from '@/context/BookingContext';
import { TimeSlot } from '@/types/booking';
import { Colors } from '@/constants/Colors';

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    if (d < todayStr) return; // no past dates
    setSelectedDate(d);
    setSelectedTime(''); // reset time when date changes
  };

  const canContinue = !!selectedDate && !!selectedTime;

  const handleNext = () => {
    setDateTime(selectedDate, selectedTime);
    router.push('/(customer)/book/location');
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={3} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Calendar ── */}
        <View style={s.calCard}>
          {/* Month nav */}
          <View style={s.calHeader}>
            <Pressable onPress={prevMonth} style={s.calNavBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={Colors.accent} />
            </Pressable>
            <Text style={s.calTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
            <Pressable onPress={nextMonth} style={s.calNavBtn} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
            </Pressable>
          </View>

          {/* Day-of-week labels */}
          <View style={s.calDOW}>
            {DAY_NAMES.map(d => <Text key={d} style={s.calDOWText}>{d}</Text>)}
          </View>

          {/* Day grid */}
          <View style={s.calGrid}>
            {days.map((day, i) => {
              if (day === null) return <View key={`null-${i}`} style={s.calDayCell} />;
              const iso  = isoDate(calYear, calMonth, day);
              const past = iso < todayStr;
              const sel  = iso === selectedDate;
              return (
                <Pressable
                  key={iso}
                  style={[s.calDayCell, sel && s.calDaySel, past && s.calDayPast]}
                  onPress={() => handleDayPress(day)}
                  disabled={past}
                >
                  <Text style={[s.calDayText, sel && s.calDayTextSel, past && s.calDayTextPast]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Time slots ── */}
        {selectedDate ? (
          <View style={s.slotsWrap}>
            <Text style={s.slotsTitle}>
              Available times for{' '}
              <Text style={{ color: Colors.accent }}>{formatDate(selectedDate)}</Text>
            </Text>

            {loading ? (
              <ActivityIndicator color={Colors.accent} style={{ marginTop: 12 }} />
            ) : slots.length === 0 ? (
              <Text style={s.noSlots}>No availability data. Please try again.</Text>
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
                      onPress={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                    >
                      <Text style={[s.slotText, !slot.available && s.slotTextUnavail, isSel && s.slotTextSel]}>
                        {slot.time}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <Text style={s.pickDateHint}>← Select a date to see available times</Text>
        )}

      </ScrollView>

      <View style={s.footer}>
        {canContinue && (
          <Text style={s.footerSummary}>
            {formatDate(selectedDate)} at {selectedTime}
          </Text>
        )}
        <Pressable
          style={[s.nextBtn, !canContinue && s.nextBtnOff]}
          onPress={handleNext}
          disabled={!canContinue}
        >
          <Text style={s.nextBtnText}>Next — Location</Text>
          <Ionicons name="arrow-forward" size={17} color={Colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const CELL = 44;

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  content: { padding: 16, paddingBottom: 120 },

  calCard:   { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 20, ...Platform.select({ ios: { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calTitle:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  calDOW:    { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  calDOWText:{ width: CELL, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  calGrid:   { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell:{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center', borderRadius: CELL / 2 },
  calDaySel: { backgroundColor: Colors.accent },
  calDayPast:{ opacity: 0.3 },
  calDayText:{ fontSize: 14, color: Colors.textPrimary },
  calDayTextSel:  { color: Colors.white, fontWeight: '700' },
  calDayTextPast: { color: Colors.textMuted },

  slotsWrap:  { marginBottom: 20 },
  slotsTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 12 },
  noSlots:    { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 12 },
  slotsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  slotBtnSel:      { backgroundColor: Colors.accent, borderColor: Colors.accent },
  slotBtnUnavail:  { backgroundColor: Colors.background, borderColor: Colors.background },
  slotText:        { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  slotTextSel:     { color: Colors.white },
  slotTextUnavail: { color: Colors.border },

  pickDateHint: { textAlign: 'center', color: Colors.textMuted, marginTop: 20, fontSize: 13 },

  footer:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: Colors.background, ...Platform.select({ ios: { shadowColor: Colors.black, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 6 } }) },
  footerSummary:{ fontSize: 12, color: Colors.accent, fontWeight: '600', marginBottom: 8 },
  nextBtn:      { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnOff:   { opacity: 0.4 },
  nextBtnText:  { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
