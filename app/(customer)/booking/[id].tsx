// app/(customer)/booking/[id].tsx — Customer Booking Detail + QR Code
// Fetches the booking and displays:
//  • Booking status badge
//  • BookingQR component (customer shows this to staff at check-in)
//  • Summary card: service, date/time, vehicle, location, price
//  • Track / Cancel actions where applicable
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingQR } from '@/components/BookingQR';
import { Colors } from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingDetail {
  _id:             string;
  status:          'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  jobStatus:       string;
  serviceLabel:    string;
  vehicleLabel:    string;
  appointmentDate: string;
  appointmentTime: string;
  totalPrice:      number;
  durationMinutes: number;
  locationType:    'bay' | 'mobile';
  bayLabel:        string;
  bayAddress:      string;
  mobileAddress:   string;
  technicianName:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending_payment: { label: 'Awaiting Payment', color: Colors.warning, bg: Colors.warningBg, icon: 'time-outline'          },
  confirmed:       { label: 'Confirmed',         color: Colors.accent, bg: Colors.accentMuted, icon: 'checkmark-circle'     },
  cancelled:       { label: 'Cancelled',          color: Colors.error, bg: Colors.errorBg, icon: 'close-circle'        },
  completed:       { label: 'Completed',          color: Colors.success, bg: Colors.successBg, icon: 'checkmark-done-circle'},
};

const JOB_STATUS_LABELS: Record<string, string> = {
  assigned:      'Check-In Required',
  in_progress:   'Being Washed',
  completed:     'Wash Complete',
  quality_check: 'Quality Check',
  finished:      'Ready for Pickup',
};

function SummaryRow({
  icon, label, value,
}: {
  icon: string; label: string; value: string;
}) {
  return (
    <View style={s.summaryRow}>
      <Ionicons name={icon as any} size={16} color={Colors.accent} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.summaryLabel}>{label}</Text>
        <Text style={s.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking,    setBooking]    = useState<BookingDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchBooking = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      // GET /api/jobs/:id works for customers (filters by userId server-side)
      const { data } = await axios.get<BookingDetail>(`/api/jobs/${id}`);
      setBooking(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Could not load booking.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await axios.patch(`/api/bookings/${id}/cancel`);
              setBooking(prev => prev ? { ...prev, status: 'cancelled' } : prev);
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error ?? 'Could not cancel booking.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // ── Error ──
  if (error || !booking) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.border} />
          <Text style={s.errorText}>{error ?? 'Booking not found'}</Text>
          <Pressable style={s.retryBtn} onPress={() => fetchBooking()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg     = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.confirmed;
  const showQr        = booking.status === 'confirmed' && booking.jobStatus === 'assigned';
  const showTrack     = booking.status === 'confirmed' && booking.jobStatus !== 'finished';
  const canCancel     = booking.status === 'confirmed';
  const jobLabel      = JOB_STATUS_LABELS[booking.jobStatus] ?? booking.jobStatus;
  const locationText  = booking.locationType === 'bay'
    ? `${booking.bayLabel}${booking.bayAddress ? ' · ' + booking.bayAddress : ''}`
    : booking.mobileAddress || 'Mobile service';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Booking Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchBooking(true)}
            tintColor={Colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status badge ── */}
        <View style={[s.statusCard, { backgroundColor: statusCfg.bg }]}>
          <Ionicons name={statusCfg.icon as any} size={22} color={statusCfg.color} />
          <View style={{ flex: 1 }}>
            <Text style={[s.statusLabel, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
            {booking.status === 'confirmed' && (
              <Text style={s.jobStatusText}>{jobLabel}</Text>
            )}
          </View>
        </View>

        {/* ── QR Code section ── */}
        {showQr && (
          <View style={s.qrSection}>
            <Text style={s.sectionTitle}>Your Check-In Code</Text>
            <Text style={s.qrSub}>
              Show this to your technician when you arrive at the wash bay.
            </Text>
            <View style={s.qrCenter}>
              <BookingQR bookingId={booking._id} size={220} />
            </View>
          </View>
        )}

        {/* ── Summary card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Booking Summary</Text>
          <SummaryRow
            icon="layers-outline"
            label="Service"
            value={booking.serviceLabel}
          />
          <SummaryRow
            icon="car-outline"
            label="Vehicle"
            value={booking.vehicleLabel || 'Not specified'}
          />
          <SummaryRow
            icon="calendar-outline"
            label="Date & Time"
            value={`${booking.appointmentDate} at ${booking.appointmentTime}`}
          />
          <SummaryRow
            icon={booking.locationType === 'bay' ? 'business-outline' : 'navigate-outline'}
            label="Location"
            value={locationText}
          />
          <SummaryRow
            icon="cash-outline"
            label="Total"
            value={`$${booking.totalPrice.toFixed(2)}`}
          />
          {booking.technicianName ? (
            <SummaryRow
              icon="person-outline"
              label="Technician"
              value={booking.technicianName}
            />
          ) : null}
        </View>

        {/* ── Already checked in notice ── */}
        {booking.status === 'confirmed' && booking.jobStatus !== 'assigned' && (
          <View style={s.checkedInBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={s.checkedInText}>
              Checked in — your wash is underway. Pull to refresh for updates.
            </Text>
          </View>
        )}

        {/* ── Actions ── */}
        <View style={s.actions}>
          {showTrack && (
            <Pressable
              style={s.trackBtn}
              onPress={() => router.push({
                pathname: '/(customer)/track/[id]',
                params:   { id: booking._id },
              })}
            >
              <Ionicons name="navigate" size={16} color={Colors.accent} />
              <Text style={s.trackBtnText}>Track My Job</Text>
            </Pressable>
          )}
          {canCancel && (
            <Pressable
              style={({ pressed }) => [
                s.cancelBtn,
                pressed     && { opacity: 0.85 },
                cancelling  && { opacity: 0.6  },
              ]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Text style={s.cancelBtnText}>Cancel Booking</Text>
              }
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },

  content: { paddingBottom: 40 },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, borderRadius: 16, padding: 16,
    marginBottom: 14, ...SHADOW,
  },
  statusLabel:   { fontSize: 15, fontWeight: '800' },
  jobStatusText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // QR section
  qrSection: {
    backgroundColor: Colors.white,
    marginHorizontal: 16, borderRadius: 20,
    padding: 20, marginBottom: 14, alignItems: 'center',
    ...SHADOW,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  qrSub:        { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 18 },
  qrCenter:     { alignItems: 'center' },

  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16, borderRadius: 16,
    padding: 18, marginBottom: 14, ...SHADOW,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, marginBottom: 12,
  },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },

  checkedInBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.successBg, borderRadius: 12, padding: 14,
    marginHorizontal: 16, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: Colors.success,
  },
  checkedInText: { flex: 1, fontSize: 13, color: Colors.success, fontWeight: '600', lineHeight: 18 },

  actions:  { marginHorizontal: 16, gap: 10 },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accentMuted, borderRadius: 14, paddingVertical: 14,
  },
  trackBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  cancelBtn:    { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.error },
  cancelBtnText:{ color: Colors.error, fontSize: 15, fontWeight: '700' },

  errorText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryBtn:  { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.accentMuted, borderRadius: 999 },
  retryText: { color: Colors.accent, fontWeight: '700' },
});
