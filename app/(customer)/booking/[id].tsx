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
  ActivityIndicator, Alert, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingQR } from '@/components/BookingQR';
import { ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';
import ReAnimated, { FadeIn } from 'react-native-reanimated';

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
  pending_payment: { label: 'Awaiting Payment', color: Colors.warning,  bg: Colors.warningBg,   icon: 'time-outline'          },
  confirmed:       { label: 'Confirmed',         color: Colors.accent,   bg: Colors.accentMuted, icon: 'checkmark-circle'      },
  cancelled:       { label: 'Cancelled',          color: Colors.error,    bg: Colors.errorBg,     icon: 'close-circle'          },
  completed:       { label: 'Completed',          color: Colors.success,  bg: Colors.successBg,   icon: 'checkmark-done-circle' },
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
      <View style={s.summaryIconWrap}>
        <Ionicons name={icon as any} size={15} color={Colors.accent} />
      </View>
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
          <Pressable
            style={s.headerIconBtn}
            onPress={() => router.back()}
            hitSlop={8}
            android_ripple={{ color: Colors.border, borderless: true, radius: 20 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={s.centered}>
          <View style={s.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          </View>
          <Text style={s.errorText}>{error ?? 'Booking not found'}</Text>
          <Pressable
            style={s.retryBtn}
            onPress={() => fetchBooking()}
            android_ripple={{ color: Colors.primaryDark }}
          >
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
      <ScreenHeader title="Booking Details" backButton />

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
        <ReAnimated.View entering={FadeIn.duration(300)}>
        {/* ── Status banner ── */}
        <View style={[s.statusCard, { backgroundColor: statusCfg.bg }]}>
          <View style={[s.statusIconWrap, { backgroundColor: statusCfg.color + '22' }]}>
            <Ionicons name={statusCfg.icon as any} size={20} color={statusCfg.color} />
          </View>
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
            <View style={s.qrHeader}>
              <Ionicons name="qr-code-outline" size={18} color={Colors.accent} />
              <Text style={s.sectionTitle}>Your Check-In Code</Text>
            </View>
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

        {/* ── Checked-in notice ── */}
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
              android_ripple={{ color: Colors.accent }}
            >
              <Ionicons name="navigate" size={16} color={Colors.accent} />
              <Text style={s.trackBtnText}>Track My Job</Text>
            </Pressable>
          )}
          {canCancel && (
            <Pressable
              style={({ pressed }) => [
                s.cancelBtn,
                pressed    && { opacity: 0.85 },
                cancelling && { opacity: 0.6  },
              ]}
              onPress={handleCancel}
              disabled={cancelling}
              android_ripple={{ color: Colors.errorBg }}
            >
              {cancelling
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Text style={s.cancelBtnText}>Cancel Booking</Text>
              }
            </Pressable>
          )}
        </View>
        </ReAnimated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },

  content: { paddingBottom: 44, paddingTop: 4 },

  errorIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.errorBg,
    alignItems: 'center', justifyContent: 'center',
  },
  errorText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryBtn:  {
    paddingHorizontal: 28, paddingVertical: 12,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  retryText: { color: Colors.white, fontWeight: '700' },

  // Status banner
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, borderRadius: borderRadius.lg,
    padding: 16, marginTop: 16, marginBottom: 12,
    ...cardShadow,
  },
  statusIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  statusLabel:   { fontSize: 15, fontWeight: '800' },
  jobStatusText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // QR section
  qrSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    ...cardShadow,
  },
  qrHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  qrSub:        { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  qrCenter:     { alignItems: 'center' },

  // Summary card
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 12,
    ...cardShadow,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, marginBottom: 14,
  },
  summaryIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },

  // Checked-in banner
  checkedInBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.successBg,
    borderRadius: borderRadius.md,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.success,
  },
  checkedInText: { flex: 1, fontSize: 13, color: Colors.success, fontWeight: '600', lineHeight: 18 },

  // Actions
  actions:  { marginHorizontal: 20, gap: 10, marginTop: 4 },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.lg,
    paddingVertical: 15,
    overflow: 'hidden',
  },
  trackBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  cancelBtn:    {
    borderRadius: borderRadius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.error,
    overflow: 'hidden',
  },
  cancelBtnText:{ color: Colors.error, fontSize: 15, fontWeight: '700' },
});
