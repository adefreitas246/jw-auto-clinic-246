// app/(customer)/rate/index.tsx — Rate Your Washes
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RateableBooking {
  _id:             string;
  serviceLabel:    string;
  vehicleLabel:    string;
  appointmentDate: string;
  technicianName:  string;
  rated:           boolean;
  rating?:         number;
}

// ── Star row (for rated cards) ────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons
          key={s}
          name={s <= rating ? 'star' : 'star-outline'}
          size={13}
          color={Colors.warning}
        />
      ))}
    </View>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function RateCard({ item, index }: { item: RateableBooking; index: number }) {
  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={[rc.card, item.rated && rc.cardRated]}>
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
            {item.rated && item.rating != null ? (
              <StarRow rating={item.rating} />
            ) : null}
          </View>

          {item.rated ? (
            <View style={rc.ratedBadge}>
              <Text style={rc.ratedText}>Rated</Text>
            </View>
          ) : (
            <Pressable
              style={rc.rateNowBtn}
              onPress={() => router.push({
                pathname: '/(customer)/rate/[bookingId]',
                params: { bookingId: item._id },
              })}
              android_ripple={{ color: Colors.white + '30', borderless: false }}
            >
              <Text style={rc.rateNowText}>Rate Now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ReAnimated.View>
  );
}

const rc = StyleSheet.create({
  card:          { backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  cardRated:     { opacity: 0.68 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:      { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  iconWrapRated: { backgroundColor: Colors.warningBg },
  serviceName:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  meta:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  metaText:      { fontSize: 12, color: Colors.textMuted },
  dot:           { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  vehicle:       { fontSize: 11, color: Colors.textMuted },
  ratedBadge:    { backgroundColor: Colors.warningBg, borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  ratedText:     { fontSize: 11, fontWeight: '700', color: Colors.warningText },
  rateNowBtn:    { backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 8, overflow: 'hidden' },
  rateNowText:   { fontSize: 13, fontWeight: '700', color: Colors.white },
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

  const unrated = bookings.filter(b => !b.rated);
  const rated   = bookings.filter(b =>  b.rated);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="Rate Your Washes" backButton />

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
      ) : bookings.length === 0 ? (
        <View style={s.centered}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="star-outline" size={36} color={Colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>No washes to rate yet</Text>
          <Text style={s.emptyText}>Complete a booking to leave your review.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
        >
          {/* Unrated section */}
          {unrated.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Awaiting Your Review</Text>
              {unrated.map((item, i) => (
                <View key={item._id} style={{ marginBottom: 10 }}>
                  <RateCard item={item} index={i} />
                </View>
              ))}
            </>
          )}

          {/* Rated section */}
          {rated.length > 0 && (
            <>
              <Text style={[s.sectionTitle, unrated.length > 0 && { marginTop: 8 }]}>
                Already Rated
              </Text>
              {rated.map((item, i) => (
                <View key={item._id} style={{ marginBottom: 10 }}>
                  <RateCard item={item} index={unrated.length + i} />
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },

  list:         { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  errorText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryBtn:  { backgroundColor: Colors.accent, borderRadius: borderRadius.full, paddingHorizontal: 24, paddingVertical: 10, overflow: 'hidden' },
  retryText: { color: Colors.white, fontWeight: '700' },

  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText:     { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
});
