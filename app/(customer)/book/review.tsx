// app/(customer)/book/review.tsx — Step 5: Review summary + choose payment method
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { Colors } from '@/constants/Colors';
import { useBooking } from '@/context/BookingContext';
import { PaymentMethod } from '@/types/booking';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

const fmt     = (n: number) => `$${n.toFixed(2)}`;
const fmtMins = (m: number) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;

type ReviewRow = {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: 'wipay',  label: 'WiPay',         icon: 'card' },
  { id: 'bimpay', label: 'BIMPay',        icon: 'card-outline' },
  { id: 'cash',   label: 'Pay with Cash', icon: 'cash-outline' },
];

export default function BookReviewStep() {
  const { draft, setPaymentMethod, setNotes, setCoupon, clearDiscount, submitBooking } = useBooking();
  const [submitting, setSubmitting] = useState(false);

  // Coupon state
  const [couponInput,    setCouponInput]    = useState(draft.couponCode || '');
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponMsg,      setCouponMsg]      = useState<{ ok: boolean; text: string } | null>(
    draft.couponValid ? { ok: true, text: `−$${draft.discountAmount.toFixed(2)} discount applied` } : null
  );

  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponChecking(true);
    setCouponMsg(null);
    try {
      const res = await axios.post<{
        valid: boolean; discountAmount?: number; message?: string; type?: string; value?: number;
      }>('/api/marketing/coupons/validate', { code, orderValue: draft.totalPrice });

      if (res.data.valid) {
        const disc = res.data.discountAmount ?? 0;
        setCoupon(code, disc);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCouponMsg({ ok: true, text: `Code applied — $${disc.toFixed(2)} off` });
      } else {
        clearDiscount();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setCouponMsg({ ok: false, text: res.data.message ?? 'Invalid code.' });
      }
    } catch {
      clearDiscount();
      setCouponMsg({ ok: false, text: 'Could not validate code. Try again.' });
    } finally {
      setCouponChecking(false);
    }
  }

  function handleRemoveCoupon() {
    clearDiscount();
    setCouponInput('');
    setCouponMsg(null);
  }

  const rows: ReviewRow[] = [
    { icon: 'car-outline',      label: 'Vehicle',  value: draft.vehicle ? `${draft.vehicle.make} ${draft.vehicle.model}` : 'No vehicle' },
    { icon: 'layers-outline',   label: 'Services', value: draft.selectedPackage?.name ?? 'Add-ons only' },
    { icon: 'calendar-outline', label: 'Date',     value: draft.appointmentDate || '—' },
    { icon: 'time-outline',     label: 'Time',     value: draft.appointmentTime || '—' },
    { icon: 'location-outline', label: 'Location', value: draft.locationType === 'bay' ? (draft.bay?.label ?? '—') : (draft.mobileAddress || '—') },
    { icon: 'timer-outline',    label: 'Duration', value: fmtMins(draft.durationMinutes) },
  ];

  // Add-ons summary
  const addons = Object.entries(draft.addonQty)
    .filter(([, q]) => q > 0)
    .map(([, q]) => q)
    .reduce((a, b) => a + b, 0);
  if (addons > 0) {
    rows.push({ icon: 'add-circle-outline', label: 'Add-ons', value: `${addons} add-on${addons > 1 ? 's' : ''}` });
  }

  const handleBook = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const { bookingId, paymentUrl } = await submitBooking();
      if (draft.paymentMethod === 'cash') {
        router.replace({ pathname: '/(customer)/book/confirmed', params: { bookingId } });
      } else {
        router.push({ pathname: '/(customer)/book/payment', params: { paymentUrl: paymentUrl ?? '', bookingId } });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Could not create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const finalTotal = Math.max(0, draft.totalPrice - draft.discountAmount);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={5} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.heading}>Review your booking</Text>

        {/* ── Summary card ── */}
        <View style={s.summaryCard}>
          {rows.map((row, i) => (
            <View key={row.label} style={[s.summaryRow, i < rows.length - 1 && s.summaryRowBorder]}>
              <View style={s.summaryIconWrap}>
                <Ionicons name={row.icon} size={16} color={Colors.accent} />
              </View>
              <Text style={s.summaryLabel}>{row.label}</Text>
              <Text style={s.summaryValue} numberOfLines={2}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Coupon code ── */}
        <Text style={s.sectionTitle}>Promo / Coupon Code</Text>
        <View style={s.couponRow}>
          <View style={[s.couponInputWrap, draft.couponValid && s.couponInputWrapValid]}>
            <Ionicons
              name="pricetag-outline"
              size={16}
              color={draft.couponValid ? Colors.success : Colors.textMuted}
            />
            <TextInput
              style={s.couponInput}
              value={couponInput}
              onChangeText={v => {
                setCouponInput(v.toUpperCase());
                if (draft.couponValid) clearDiscount();
                setCouponMsg(null);
              }}
              placeholder="Enter code"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              editable={!draft.couponValid}
            />
          </View>
          {draft.couponValid ? (
            <Pressable
              style={s.couponRemoveBtn}
              onPress={handleRemoveCoupon}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Ionicons name="close" size={16} color={Colors.error} />
              <Text style={s.couponRemoveText}>Remove</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.couponApplyBtn, (!couponInput.trim() || couponChecking) && { opacity: 0.5 }]}
              onPress={handleApplyCoupon}
              disabled={!couponInput.trim() || couponChecking}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              {couponChecking
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={s.couponApplyText}>Apply</Text>
              }
            </Pressable>
          )}
        </View>
        {couponMsg && (
          <View style={[s.couponMsgWrap, couponMsg.ok ? s.couponMsgWrapOk : s.couponMsgWrapErr]}>
            <Ionicons
              name={couponMsg.ok ? 'checkmark-circle-outline' : 'close-circle-outline'}
              size={14}
              color={couponMsg.ok ? Colors.success : Colors.error}
            />
            <Text style={[s.couponMsg, couponMsg.ok ? s.couponMsgOk : s.couponMsgErr]}>
              {couponMsg.text}
            </Text>
          </View>
        )}

        {/* ── Price card ── */}
        <View style={s.priceCard}>
          {draft.discountAmount > 0 && (
            <>
              <View style={s.priceRow}>
                <Text style={s.priceRowLabel}>Subtotal</Text>
                <Text style={s.priceRowStrike}>{fmt(draft.totalPrice)}</Text>
              </View>
              <View style={s.priceRow}>
                <Text style={s.priceRowLabel}>Discount</Text>
                <Text style={s.priceRowSaving}>−{fmt(draft.discountAmount)}</Text>
              </View>
              <View style={s.priceDivider} />
            </>
          )}
          <View style={s.priceTotalRow}>
            <Text style={s.priceTotalLabel}>Total</Text>
            <Text style={s.priceTotalAmount}>{fmt(finalTotal)}</Text>
          </View>
        </View>

        {/* ── Payment method ── */}
        <Text style={s.sectionTitle}>Payment Method</Text>
        <View style={s.paymentRow}>
          {PAYMENT_OPTIONS.map(opt => {
            const active = draft.paymentMethod === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[s.payBtn, active && s.payBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPaymentMethod(opt.id);
                }}
                android_ripple={{ color: Colors.accent + '12', borderless: false }}
              >
                <View style={[s.payIconWrap, active && s.payIconWrapActive]}>
                  <Ionicons name={opt.icon} size={20} color={active ? Colors.accent : Colors.textMuted} />
                </View>
                <Text style={[s.payBtnText, active && s.payBtnTextActive]}>{opt.label}</Text>
                {active && (
                  <View style={s.payCheckDot}>
                    <Ionicons name="checkmark" size={10} color={Colors.white} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Notes ── */}
        <Text style={s.sectionTitle}>Notes (optional)</Text>
        <View style={s.notesWrap}>
          <Ionicons name="create-outline" size={16} color={Colors.textMuted} style={s.notesIcon} />
          <TextInput
            style={s.notesInput}
            placeholder="Any special instructions for the team…"
            placeholderTextColor={Colors.textMuted}
            value={draft.notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Text style={s.footerTotalLabel}>Total</Text>
          <Text style={s.footerTotal}>{fmt(finalTotal)}</Text>
          <Text style={s.footerMethod}>
            via {PAYMENT_OPTIONS.find(p => p.id === draft.paymentMethod)?.label}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [s.bookBtn, submitting && { opacity: 0.7 }, pressed && !submitting && { opacity: 0.88 }]}
          onPress={handleBook}
          disabled={submitting}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={s.bookBtnText}>
                {draft.paymentMethod === 'cash' ? 'Confirm Booking' : 'Proceed to Payment'}
              </Text>
              <Ionicons name="arrow-forward" size={17} color={Colors.white} />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 120 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },

  // Summary card
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: 20,
    ...cardShadow,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  summaryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryLabel: { fontSize: 13, color: Colors.textMuted, width: 70 },
  summaryValue: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },

  // Coupon
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10, marginTop: 4 },
  couponRow:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  couponInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  couponInputWrapValid: { borderColor: Colors.success, backgroundColor: Colors.successBg },
  couponInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.textPrimary,
  },
  couponApplyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  couponApplyText:   { color: Colors.white, fontWeight: '700', fontSize: 13 },
  couponRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: Colors.errorBg,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
  },
  couponRemoveText: { color: Colors.error, fontWeight: '600', fontSize: 12 },
  couponMsgWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  couponMsgWrapOk:  { backgroundColor: Colors.successBg },
  couponMsgWrapErr: { backgroundColor: Colors.errorBg },
  couponMsg:        { fontSize: 12, fontWeight: '600' },
  couponMsgOk:      { color: Colors.successText },
  couponMsgErr:     { color: Colors.errorText },

  // Price card
  priceCard: {
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  priceRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceRowLabel:   { fontSize: 13, color: Colors.accentDark, fontWeight: '600' },
  priceRowStrike:  { fontSize: 13, color: Colors.accentDark, textDecorationLine: 'line-through' },
  priceRowSaving:  { fontSize: 13, color: Colors.success, fontWeight: '700' },
  priceDivider:    { height: 1, backgroundColor: Colors.accent + '30', marginBottom: 10 },
  priceTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceTotalLabel: { fontSize: 14, fontWeight: '700', color: Colors.accentDark },
  priceTotalAmount:{ fontSize: 28, fontWeight: '800', color: Colors.accent },

  // Payment method
  paymentRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  payBtn: {
    flex: 1,
    minWidth: 90,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    ...cardShadow,
  },
  payBtnActive:     { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  payIconWrap:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  payIconWrapActive:{ backgroundColor: Colors.accent + '20' },
  payBtnText:       { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
  payBtnTextActive: { color: Colors.accent },
  payCheckDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notes
  notesWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 8,
  },
  notesIcon:  { marginTop: 2 },
  notesInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, minHeight: 72, lineHeight: 20 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 14,
    paddingBottom: IS_IOS ? 32 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    ...(IS_IOS
      ? { shadowColor: Colors.shadow, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } }
      : { elevation: 8 }),
  },
  footerLeft:        { flex: 1 },
  footerTotalLabel:  { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerTotal:       { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  footerMethod:      { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  bookBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
