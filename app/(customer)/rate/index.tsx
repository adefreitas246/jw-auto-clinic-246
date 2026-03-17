// app/(customer)/rate/index.tsx — Rate a Service
// Lists the customer's completed bookings that can be reviewed.
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

interface RateableBooking {
  _id:             string;
  serviceLabel:    string;
  vehicleLabel:    string;
  appointmentDate: string;
  technicianName:  string;
  rated:           boolean;
}

// ── Booking row ───────────────────────────────────────────────────────────────

function RateCard({ item, index }: { item: RateableBooking; index: number }) {
  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        style={({ pressed }) => [rc.card, pressed && { opacity: 0.92 }, item.rated && rc.cardRated]}
        onPress={() => {
          if (!item.rated) {
            router.push({ pathname: '/(customer)/rate/[bookingId]', params: { bookingId: item._id } });
          }
        }}
        disabled={item.rated}
        android_ripple={{ color: Colors.accent + '15', borderless: false }}
      >
        <View style={rc.row}>
          <View style={[rc.iconWrap, item.rated && rc.iconWrapRated]}>
            <Ionicons
              name={item.rated ? 'star' : 'star-outline'}
              size={20}
              color={item.rated ? Colors.warning : Colors.accent}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={rc.serviceName} numberOfLines={1}>{item.serviceLabel}</Text>
            <View style={rc.meta}>
              <Text style={rc.metaText}>{item.appointmentDate}</Text>
              {item.technicianName ? (
                <>
                  <View style={rc.dot} />
                  <Text style={rc.metaText}>{item.technicianName}</Text>
                </>
              ) : null}
            </View>
            {item.vehicleLabel ? (
              <Text style={rc.vehicle} numberOfLines={1}>{item.vehicleLabel}</Text>
            ) : null}
          </View>

          {item.rated ? (
            <View style={rc.ratedBadge}>
              <Text style={rc.ratedText}>Rated</Text>
            </View>
          ) : (
            <View style={rc.rateCta}>
              <Text style={rc.rateCtaText}>Rate</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
            </View>
          )}
        </View>
      </Pressable>
    </ReAnimated.View>
  );
}

const rc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  cardRated: { opacity: 0.65 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:  {
    width: 44, height: 44, borderRadius: borderRadius.md,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapRated: { backgroundColor: Colors.warningBg },
  serviceName:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  meta:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  metaText:      { fontSize: 12, color: Colors.textMuted },
  dot:           { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  vehicle:       { fontSize: 11, color: Colors.textMuted },
  ratedBadge:    {
    backgroundColor: Colors.warningBg, borderRadius: borderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  ratedText:     { fontSize: 11, fontWeight: '700', color: Colors.warningText },
  rateCta:       { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rateCtaText:   { fontSize: 13, fontWeight: '700', color: Colors.accent },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RateServiceScreen() {
  const [bookings,   setBookings]   = useState<RateableBooking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchBookings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<RateableBooking[]>('/api/bookings?status=completed');
      setBookings(data);
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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="Rate a Service" backButton />

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
          data={bookings}
          keyExtractor={b => b._id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          renderItem={({ item, index }) => <RateCard item={item} index={index} />}
          ListHeaderComponent={bookings.length > 0 ? (
            <View style={s.listHeader}>
              <Text style={s.listHeaderText}>
                Tap a completed wash to leave your review.
              </Text>
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="star-outline" size={36} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No completed washes</Text>
              <Text style={s.emptyText}>
                Your completed bookings will appear here for rating.
              </Text>
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

  list:       { paddingHorizontal: SCREEN_PADDING, paddingTop: 12, paddingBottom: SCROLL_PADDING_BOTTOM },
  listHeader: { marginBottom: 12 },
  listHeaderText: { fontSize: 13, color: Colors.textMuted },

  errorText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryBtn:  { backgroundColor: Colors.accent, borderRadius: borderRadius.full, paddingHorizontal: 24, paddingVertical: 10, overflow: 'hidden' },
  retryText: { color: Colors.white, fontWeight: '700' },

  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText:    { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
