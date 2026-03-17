// app/(customer)/booking/index.tsx — My Bookings (history list)
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Booking {
  _id:             string;
  status:          'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  jobStatus:       string;
  serviceLabel:    string;
  vehicleLabel:    string;
  appointmentDate: string;
  appointmentTime: string;
  totalPrice:      number;
  locationType:    'bay' | 'mobile';
  bayLabel:        string;
}

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Awaiting Payment', color: Colors.warning,  bg: Colors.warningBg  },
  confirmed:       { label: 'Confirmed',         color: Colors.accent,   bg: Colors.accentMuted },
  cancelled:       { label: 'Cancelled',          color: Colors.error,    bg: Colors.errorBg    },
  completed:       { label: 'Completed',          color: Colors.success,  bg: Colors.successBg  },
};

const JOB_STATUS_LABELS: Record<string, string> = {
  assigned:      'Check-In Required',
  in_progress:   'Being Washed',
  completed:     'Wash Complete',
  quality_check: 'Quality Check',
  finished:      'Ready for Pickup',
};

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'upcoming',  label: 'Upcoming'  },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function filterBookings(list: Booking[], filter: Filter): Booking[] {
  if (filter === 'all')       return list;
  if (filter === 'upcoming')  return list.filter(b => b.status === 'confirmed' || b.status === 'pending_payment');
  if (filter === 'completed') return list.filter(b => b.status === 'completed');
  if (filter === 'cancelled') return list.filter(b => b.status === 'cancelled');
  return list;
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({ booking, index }: { booking: Booking; index: number }) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.confirmed;
  const jobLabel = JOB_STATUS_LABELS[booking.jobStatus];

  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 40).springify()}>
      <Pressable
        style={({ pressed }) => [bc.card, pressed && { opacity: 0.92 }]}
        onPress={() => router.push({
          pathname: '/(customer)/booking/[id]',
          params: { id: booking._id },
        })}
        android_ripple={{ color: Colors.accent + '15', borderless: false }}
      >
        {/* Service + status row */}
        <View style={bc.topRow}>
          <Text style={bc.serviceName} numberOfLines={1}>{booking.serviceLabel}</Text>
          <View style={[bc.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[bc.badgeText, { color: cfg.color }]}>
              {jobLabel ?? cfg.label}
            </Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={bc.metaRow}>
          <View style={bc.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
            <Text style={bc.metaText}>{booking.appointmentDate} · {booking.appointmentTime}</Text>
          </View>
          <View style={bc.metaItem}>
            <Ionicons name="car-outline" size={12} color={Colors.textMuted} />
            <Text style={bc.metaText} numberOfLines={1}>{booking.vehicleLabel || 'No vehicle'}</Text>
          </View>
        </View>

        {/* Footer row */}
        <View style={bc.footer}>
          <View style={bc.metaItem}>
            <Ionicons
              name={booking.locationType === 'bay' ? 'business-outline' : 'navigate-outline'}
              size={12} color={Colors.textMuted}
            />
            <Text style={bc.metaText}>{booking.bayLabel || (booking.locationType === 'mobile' ? 'Mobile service' : '—')}</Text>
          </View>
          <Text style={bc.price}>${booking.totalPrice?.toFixed(2) ?? '—'}</Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.border}
          style={bc.chevron}
        />
      </Pressable>
    </ReAnimated.View>
  );
}

const bc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  topRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  serviceName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  badge:       { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', gap: 14, marginBottom: 8 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText:    { fontSize: 12, color: Colors.textMuted, flex: 1 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  price:       { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  chevron:     { position: 'absolute', right: 16, top: '50%' },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyBookingsScreen() {
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<Filter>('all');
  const [error,      setError]      = useState<string | null>(null);

  const fetchBookings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<Booking[]>('/api/bookings');
      // Sort newest first
      setBookings(data.sort((a, b) =>
        new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
      ));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Could not load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchBookings(); }, [fetchBookings]));

  const onRefresh = () => { setRefreshing(true); fetchBookings(true); };

  const filtered = filterBookings(bookings, filter);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="My Bookings" backButton />

      {/* Filter tabs */}
      <View style={s.filters}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[s.filterBtn, filter === f.key && s.filterBtnActive]}
            onPress={() => setFilter(f.key)}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : error ? (
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => fetchBookings()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b._id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          renderItem={({ item, index }) => <BookingCard booking={item} index={index} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={36} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No bookings yet</Text>
              <Text style={s.emptyText}>
                {filter === 'all'
                  ? "You haven't made any bookings yet."
                  : `No ${filter} bookings found.`}
              </Text>
              {filter === 'all' && (
                <Pressable
                  style={s.bookNowBtn}
                  onPress={() => router.push('/(customer)/book')}
                  android_ripple={{ color: Colors.accentDark, borderless: false }}
                >
                  <Text style={s.bookNowText}>Book a Wash</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },

  // Filter tabs
  filters: {
    flexDirection: 'row',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterBtn: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5, borderColor: Colors.border,
    overflow: 'hidden',
  },
  filterBtnActive: { backgroundColor: Colors.accentMuted, borderColor: Colors.accent },
  filterText:      { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  filterTextActive:{ color: Colors.accent },

  // List
  list: { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: SCROLL_PADDING_BOTTOM },

  // Error
  errorText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryBtn:  { backgroundColor: Colors.accent, borderRadius: borderRadius.full, paddingHorizontal: 24, paddingVertical: 10, overflow: 'hidden' },
  retryText: { color: Colors.white, fontWeight: '700' },

  // Empty
  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText:    { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  bookNowBtn:   { backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingHorizontal: 28, paddingVertical: 13, overflow: 'hidden' },
  bookNowText:  { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
