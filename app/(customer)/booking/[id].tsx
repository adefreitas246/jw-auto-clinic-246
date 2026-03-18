// app/(customer)/booking/[id].tsx — Customer Booking Detail + QR Code
// Fetches the booking and displays:
//  • Large centered status badge
//  • QR code (shown for all upcoming bookings)
//  • Service info card: service, date, time, location, duration, price
//  • Vehicle card: make/model, plate, color, size
//  • Context-aware action buttons (Track + Cancel | Rate + Book Again | Book Again)
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BookingQR } from '@/components/BookingQR';
import { ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingDetail {
  _id:             string;
  status:          'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  jobStatus:       string;
  serviceLabel:    string;
  vehicleLabel:    string;
  vehicleMake?:    string;
  vehicleModel?:   string;
  vehiclePlate?:   string;
  vehicleColor?:   string;
  vehicleSize?:    string;
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

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg:    string;
  icon:  React.ComponentProps<typeof Ionicons>['name'];
}> = {
  pending_payment: { label: 'Awaiting Payment', color: Colors.warning, bg: Colors.warningBg,   icon: 'time-outline'           },
  confirmed:       { label: 'Confirmed',         color: Colors.accent,  bg: Colors.accentMuted, icon: 'checkmark-circle'       },
  cancelled:       { label: 'Cancelled',         color: Colors.error,   bg: Colors.errorBg,     icon: 'close-circle'           },
  completed:       { label: 'Completed',         color: Colors.success, bg: Colors.successBg,   icon: 'checkmark-done-circle'  },
};

const JOB_STATUS_LABELS: Record<string, string> = {
  assigned:      'Check-In Required',
  in_progress:   'Being Washed',
  completed:     'Wash Complete',
  quality_check: 'Quality Check',
  finished:      'Ready for Pickup',
};

const UPCOMING = new Set(['pending_payment', 'confirmed']);

// ─── Summary row ──────────────────────────────────────────────────────────────

function SummaryRow({
  icon, label, value,
}: {
  icon:  React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={s.summaryRow}>
      <View style={s.summaryIconWrap}>
        <Ionicons name={icon} size={15} color={Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.summaryLabel}>{label}</Text>
        <Text style={s.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

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
      const { data } = await axios.get<BookingDetail>(`/api/bookings/${id}`);
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
      ],
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScreenHeader title="Booking Details" backButton />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error || !booking) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScreenHeader title="Booking Details" backButton />
        <View style={s.centered}>
          <View style={s.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          </View>
          <Text style={s.errorText}>{error ?? 'Booking not found'}</Text>
          <Pressable
            style={s.retryBtn}
            onPress={() => fetchBooking()}
            android_ripple={{ color: Colors.accentDark, borderless: false }}
          >
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const statusCfg   = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.confirmed;
  const isUpcoming  = UPCOMING.has(booking.status);
  const jobLabel    = JOB_STATUS_LABELS[booking.jobStatus] ?? booking.jobStatus;
  const locationText = booking.locationType === 'bay'
    ? `${booking.bayLabel}${booking.bayAddress ? ' · ' + booking.bayAddress : ''}`
    : booking.mobileAddress || 'Mobile service';
  const vehicleHasDetail = booking.vehicleMake || booking.vehiclePlate;

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

          {/* ── Status badge — large, centered ── */}
          <ReAnimated.View entering={FadeInDown.delay(0).duration(300)}>
            <View style={[s.statusCard, { backgroundColor: statusCfg.bg }]}>
              <View style={[s.statusIconWrap, { backgroundColor: statusCfg.color + '22' }]}>
                <Ionicons name={statusCfg.icon} size={28} color={statusCfg.color} />
              </View>
              <Text style={[s.statusLabel, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
              {isUpcoming && booking.jobStatus ? (
                <Text style={s.jobStatusText}>{jobLabel}</Text>
              ) : null}
            </View>
          </ReAnimated.View>

          {/* ── QR Code — show for all upcoming bookings ── */}
          {isUpcoming && (
            <ReAnimated.View entering={FadeInDown.delay(80).duration(300)}>
              <View style={s.qrSection}>
                <View style={s.qrHeader}>
                  <Ionicons name="qr-code-outline" size={18} color={Colors.accent} />
                  <Text style={s.sectionTitle}>Your Check-In Code</Text>
                </View>
                <Text style={s.qrSub}>Show this at arrival</Text>
                <View style={s.qrCenter}>
                  <BookingQR bookingId={booking._id} size={200} />
                </View>
              </View>
            </ReAnimated.View>
          )}

          {/* ── Service info card ── */}
          <ReAnimated.View entering={FadeInDown.delay(160).duration(300)}>
            <View style={s.card}>
              <Text style={s.cardTitle}>Service Details</Text>
              <SummaryRow icon="layers-outline"   label="Service"  value={booking.serviceLabel} />
              <SummaryRow icon="calendar-outline" label="Date"     value={booking.appointmentDate} />
              <SummaryRow icon="time-outline"     label="Time"     value={booking.appointmentTime} />
              <SummaryRow
                icon={booking.locationType === 'bay' ? 'business-outline' : 'navigate-outline'}
                label="Location"
                value={locationText}
              />
              {booking.durationMinutes ? (
                <SummaryRow
                  icon="hourglass-outline"
                  label="Duration"
                  value={`${booking.durationMinutes} min`}
                />
              ) : null}
              <SummaryRow icon="cash-outline" label="Total" value={`$${booking.totalPrice.toFixed(2)}`} />
              {booking.technicianName ? (
                <SummaryRow icon="person-outline" label="Technician" value={booking.technicianName} />
              ) : null}
            </View>
          </ReAnimated.View>

          {/* ── Vehicle card ── */}
          <ReAnimated.View entering={FadeInDown.delay(240).duration(300)}>
            <View style={s.card}>
              <Text style={s.cardTitle}>Vehicle</Text>
              {vehicleHasDetail ? (
                <>
                  {(booking.vehicleMake || booking.vehicleModel) ? (
                    <SummaryRow
                      icon="car-sport-outline"
                      label="Make & Model"
                      value={[booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(' ')}
                    />
                  ) : null}
                  {booking.vehiclePlate ? (
                    <SummaryRow icon="barcode-outline"       label="Plate" value={booking.vehiclePlate} />
                  ) : null}
                  {booking.vehicleColor ? (
                    <SummaryRow icon="color-palette-outline" label="Color" value={booking.vehicleColor} />
                  ) : null}
                  {booking.vehicleSize ? (
                    <SummaryRow icon="resize-outline"        label="Size"  value={booking.vehicleSize}  />
                  ) : null}
                </>
              ) : (
                <SummaryRow icon="car-outline" label="Vehicle" value={booking.vehicleLabel || 'Not specified'} />
              )}
            </View>
          </ReAnimated.View>

          {/* ── Checked-in notice ── */}
          {booking.status === 'confirmed' && booking.jobStatus && booking.jobStatus !== 'assigned' && (
            <View style={s.checkedInBanner}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={s.checkedInText}>
                Checked in — your wash is underway. Pull to refresh for updates.
              </Text>
            </View>
          )}

          {/* ── Actions ── */}
          <ReAnimated.View entering={FadeInDown.delay(320).duration(300)} style={s.actions}>

            {/* Upcoming: Track + Cancel */}
            {isUpcoming && (
              <>
                {booking.jobStatus !== 'finished' && (
                  <Pressable
                    style={s.primaryBtn}
                    onPress={() => router.push({
                      pathname: '/(customer)/track/[id]',
                      params:   { id: booking._id },
                    })}
                    android_ripple={{ color: Colors.accentDark, borderless: false }}
                  >
                    <Ionicons name="navigate" size={16} color={Colors.white} />
                    <Text style={s.primaryBtnText}>Track Wash</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [
                    s.cancelBtn,
                    pressed    && { opacity: 0.85 },
                    cancelling && { opacity: 0.6 },
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
              </>
            )}

            {/* Completed: Rate + Book Again */}
            {booking.status === 'completed' && (
              <>
                <Pressable
                  style={s.primaryBtn}
                  onPress={() => router.push({
                    pathname: '/(customer)/rate/[bookingId]',
                    params:   { bookingId: booking._id },
                  })}
                  android_ripple={{ color: Colors.accentDark, borderless: false }}
                >
                  <Ionicons name="star-outline" size={16} color={Colors.white} />
                  <Text style={s.primaryBtnText}>Rate This Wash</Text>
                </Pressable>
                <Pressable
                  style={s.secondaryBtn}
                  onPress={() => router.push('/(customer)/book')}
                  android_ripple={{ color: Colors.accentMuted, borderless: false }}
                >
                  <Text style={s.secondaryBtnText}>Book Again</Text>
                </Pressable>
              </>
            )}

            {/* Cancelled: Book Again */}
            {booking.status === 'cancelled' && (
              <Pressable
                style={s.primaryBtn}
                onPress={() => router.push('/(customer)/book')}
                android_ripple={{ color: Colors.accentDark, borderless: false }}
              >
                <Text style={s.primaryBtnText}>Book Again</Text>
              </Pressable>
            )}

          </ReAnimated.View>
        </ReAnimated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  content:  { paddingBottom: SCROLL_PADDING_BOTTOM, paddingTop: 4 },

  // Error state
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

  // Status badge — large, centered
  statusCard: {
    alignItems: 'center',
    marginHorizontal: SCREEN_PADDING,
    borderRadius: borderRadius.lg,
    paddingVertical: 28,
    paddingHorizontal: SCREEN_PADDING,
    marginTop: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  statusIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  statusLabel:   { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  jobStatusText: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },

  // QR section
  qrSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    ...cardShadow,
  },
  qrHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  qrSub:        { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 16 },
  qrCenter:     { alignItems: 'center' },

  // Cards
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 12,
    ...cardShadow,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
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
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.success,
  },
  checkedInText: { flex: 1, fontSize: 13, color: Colors.success, fontWeight: '600', lineHeight: 18 },

  // Action buttons
  actions: { marginHorizontal: SCREEN_PADDING, gap: 10, marginTop: 4, marginBottom: 8 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  primaryBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  secondaryBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },

  cancelBtn: {
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.error,
    overflow: 'hidden',
  },
  cancelBtnText: { color: Colors.error, fontSize: 15, fontWeight: '700' },
});
