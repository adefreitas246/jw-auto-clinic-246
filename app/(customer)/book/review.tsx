// app/(customer)/book/review.tsx — Step 5: Review summary + choose payment method
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { useBooking } from '@/context/BookingContext';
import { PaymentMethod } from '@/types/booking';
import axios from 'axios';

const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtMins = (m: number) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;

type ReviewRow = { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] };

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'wipay',  label: 'WiPay',        icon: 'card' },
  { id: 'bimpay', label: 'BIMPay',       icon: 'card-outline' },
  { id: 'cash',   label: 'Pay with Cash', icon: 'cash' },
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
        setCouponMsg({ ok: true, text: `✓ Code applied — $${disc.toFixed(2)} off` });
      } else {
        clearDiscount();
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
    { icon: 'car',       label: 'Vehicle',  value: draft.vehicle ? `${draft.vehicle.make} ${draft.vehicle.model}` : 'No vehicle' },
    { icon: 'layers',    label: 'Services', value: draft.selectedPackage?.name ?? 'Add-ons only' },
    { icon: 'calendar',  label: 'Date',     value: draft.appointmentDate || '—' },
    { icon: 'time',      label: 'Time',     value: draft.appointmentTime || '—' },
    { icon: 'location',  label: 'Location', value: draft.locationType === 'bay' ? (draft.bay?.label ?? '—') : (draft.mobileAddress || '—') },
    { icon: 'timer',     label: 'Duration', value: fmtMins(draft.durationMinutes) },
  ];

  // Add-ons summary
  const addons = Object.entries(draft.addonQty)
    .filter(([, q]) => q > 0)
    .map(([, q]) => q)
    .reduce((a, b) => a + b, 0);
  if (addons > 0) {
    rows.push({ icon: 'add-circle', label: 'Add-ons', value: `${addons} add-on${addons > 1 ? 's' : ''}` });
  }

  const handleBook = async () => {
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

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={5} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.heading}>Review your booking</Text>

        {/* Summary card */}
        <View style={s.card}>
          {rows.map((row, i) => (
            <View key={row.label} style={[s.row, i < rows.length - 1 && s.rowBorder]}>
              <View style={s.rowIcon}>
                <Ionicons name={row.icon} size={17} color="#6a0dad" />
              </View>
              <Text style={s.rowLabel}>{row.label}</Text>
              <Text style={s.rowValue} numberOfLines={2}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Coupon code */}
        <Text style={s.sectionTitle}>Promo / Coupon Code</Text>
        <View style={s.couponRow}>
          <TextInput
            style={[s.couponInput, draft.couponValid && s.couponInputValid]}
            value={couponInput}
            onChangeText={v => { setCouponInput(v.toUpperCase()); if (draft.couponValid) clearDiscount(); setCouponMsg(null); }}
            placeholder="Enter code"
            autoCapitalize="characters"
            editable={!draft.couponValid}
          />
          {draft.couponValid ? (
            <Pressable style={s.couponRemoveBtn} onPress={handleRemoveCoupon}>
              <Ionicons name="close-circle" size={18} color="#ef4444" />
              <Text style={s.couponRemoveText}>Remove</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.couponApplyBtn, (!couponInput.trim() || couponChecking) && { opacity: 0.5 }]}
              onPress={handleApplyCoupon}
              disabled={!couponInput.trim() || couponChecking}
            >
              {couponChecking
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.couponApplyText}>Apply</Text>
              }
            </Pressable>
          )}
        </View>
        {couponMsg && (
          <Text style={[s.couponMsg, couponMsg.ok ? s.couponMsgOk : s.couponMsgErr]}>
            {couponMsg.text}
          </Text>
        )}

        {/* Price */}
        <View style={s.priceCard}>
          {draft.discountAmount > 0 && (
            <View style={s.discountRow}>
              <Text style={s.discountLabel}>Subtotal</Text>
              <Text style={s.discountOriginal}>{fmt(draft.totalPrice)}</Text>
            </View>
          )}
          {draft.discountAmount > 0 && (
            <View style={s.discountRow}>
              <Text style={s.discountLabel}>Discount</Text>
              <Text style={s.discountSaving}>−{fmt(draft.discountAmount)}</Text>
            </View>
          )}
          <Text style={s.priceLabel}>Total</Text>
          <Text style={s.priceAmount}>{fmt(Math.max(0, draft.totalPrice - draft.discountAmount))}</Text>
        </View>

        {/* Payment method */}
        <Text style={s.sectionTitle}>Payment method</Text>
        <View style={s.paymentRow}>
          {PAYMENT_OPTIONS.map(opt => {
            const active = draft.paymentMethod === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[s.payBtn, active && s.payBtnActive]}
                onPress={() => setPaymentMethod(opt.id)}
              >
                <Ionicons name={opt.icon} size={20} color={active ? '#6a0dad' : '#888'} />
                <Text style={[s.payBtnText, active && s.payBtnTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notes */}
        <Text style={s.sectionTitle}>Notes (optional)</Text>
        <TextInput
          style={s.notesInput}
          placeholder="Any special instructions for the team…"
          value={draft.notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </ScrollView>

      <View style={s.footer}>
        <View>
          <Text style={s.footerTotal}>{fmt(Math.max(0, draft.totalPrice - draft.discountAmount))}</Text>
          <Text style={s.footerMethod}>via {PAYMENT_OPTIONS.find(p => p.id === draft.paymentMethod)?.label}</Text>
        </View>
        <Pressable
          style={[s.bookBtn, submitting && { opacity: 0.7 }]}
          onPress={handleBook}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={s.bookBtnText}>
                  {draft.paymentMethod === 'cash' ? 'Confirm Booking' : 'Proceed to Payment'}
                </Text>
                <Ionicons name="arrow-forward" size={17} color="#fff" />
              </>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  content: { padding: 20, paddingBottom: 120 },
  heading: { fontSize: 20, fontWeight: '800', color: '#1f1f1f', marginBottom: 16 },

  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  rowIcon:    { width: 30 },
  rowLabel:   { fontSize: 13, color: '#888', width: 72 },
  rowValue:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#1f1f1f', textAlign: 'right' },

  priceCard:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3eafd', borderRadius: 12, padding: 16, marginBottom: 20 },
  priceLabel:  { fontSize: 14, fontWeight: '700', color: '#6a0dad' },
  priceAmount: { fontSize: 24, fontWeight: '800', color: '#6a0dad' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 10, marginTop: 4 },
  paymentRow:  { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  payBtn:      { flex: 1, minWidth: 90, flexDirection: 'column', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, borderWidth: 2, borderColor: '#eee' },
  payBtnActive:{ borderColor: '#6a0dad', backgroundColor: '#fdf8ff' },
  payBtnText:  { fontSize: 12, fontWeight: '600', color: '#888' },
  payBtnTextActive: { color: '#6a0dad' },

  notesInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', padding: 12, fontSize: 14, minHeight: 80, color: '#1f1f1f' },

  couponRow:        { flexDirection: 'row', gap: 8, marginBottom: 6 },
  couponInput:      { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '600', letterSpacing: 1, color: '#1f1f1f' },
  couponInputValid: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  couponApplyBtn:   { backgroundColor: '#6a0dad', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  couponApplyText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  couponRemoveBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, backgroundColor: '#fef2f2', borderRadius: 10, borderWidth: 1, borderColor: '#fca5a5' },
  couponRemoveText: { color: '#ef4444', fontWeight: '600', fontSize: 12 },
  couponMsg:        { fontSize: 12, marginBottom: 12, fontWeight: '600' },
  couponMsgOk:      { color: '#10b981' },
  couponMsgErr:     { color: '#ef4444' },

  discountRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  discountLabel:    { fontSize: 12, color: '#6a0dad', fontWeight: '600' },
  discountOriginal: { fontSize: 12, color: '#6a0dad', textDecorationLine: 'line-through' },
  discountSaving:   { fontSize: 12, color: '#10b981', fontWeight: '700' },

  footer:       { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 6 } }) },
  footerTotal:  { fontSize: 20, fontWeight: '800', color: '#1f1f1f' },
  footerMethod: { fontSize: 11, color: '#888', marginTop: 1 },
  bookBtn:      { flex: 1, backgroundColor: '#6a0dad', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
