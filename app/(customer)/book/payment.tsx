// app/(customer)/book/payment.tsx — Step 6: WiPay / BIMPay WebView redirect
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewNavigation } from 'react-native-webview';

import { useBooking } from '@/context/BookingContext';

// Detect when the gateway redirects back to our return URL
const RETURN_HOST = 'jw-auto-clinic-246.onrender.com';

export default function BookPaymentStep() {
  const { paymentUrl: paramUrl, bookingId } = useLocalSearchParams<{
    paymentUrl: string;
    bookingId:  string;
  }>();
  const { confirmPayment } = useBooking();

  const [webLoading, setWebLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const webRef = useRef<WebView>(null);

  const handleNavChange = async (nav: WebViewNavigation) => {
    const url = nav.url;

    // Our backend payment-return handler served this URL — intercept it
    if (url.includes(RETURN_HOST) && url.includes('/api/bookings/payment-return')) {
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      const cancelled = params.get('cancelled') === '1';
      const error     = params.get('error');

      if (cancelled || error) {
        Alert.alert(
          'Payment cancelled',
          'Your payment was not completed. You can try again or choose a different method.',
          [{ text: 'Go Back', onPress: () => router.back() }]
        );
        return;
      }

      // Success path — confirm on our backend
      const reference = params.get('transaction_id') ?? params.get('reference') ?? '';
      setConfirming(true);
      try {
        await confirmPayment(reference);
        router.replace({
          pathname: '/(customer)/book/confirmed',
          params: { bookingId: bookingId ?? '' },
        });
      } catch {
        Alert.alert('Error', 'Payment was received but we could not confirm your booking. Please contact support.');
      } finally {
        setConfirming(false);
      }
    }

    // Handle deep link redirect (washhub:// scheme) triggered by our return page
    if (url.startsWith('washhub://')) {
      if (url.includes('/book/confirmed')) {
        router.replace({ pathname: '/(customer)/book/confirmed', params: { bookingId: bookingId ?? '' } });
      } else if (url.includes('error=payment_failed')) {
        Alert.alert('Payment failed', 'Your payment could not be processed. Please try again.');
        router.back();
      }
    }
  };

  if (confirming) {
    return (
      <View style={s.overlay}>
        <ActivityIndicator size="large" color="#6a0dad" />
        <Text style={s.overlayText}>Confirming your booking…</Text>
      </View>
    );
  }

  if (!paramUrl) {
    return (
      <View style={s.overlay}>
        <Ionicons name="alert-circle-outline" size={48} color="#e25555" />
        <Text style={s.overlayText}>No payment URL received.</Text>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Safe area + close button */}
      <SafeAreaView style={s.header} edges={['top']}>
        <Pressable onPress={() => router.back()} style={s.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={24} color="#1f1f1f" />
        </Pressable>
        <Text style={s.headerTitle}>Secure Payment</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {webLoading && (
        <View style={s.webLoader}>
          <ActivityIndicator size="large" color="#6a0dad" />
          <Text style={{ color: '#888', marginTop: 12 }}>Loading payment page…</Text>
        </View>
      )}

      <WebView
        ref={webRef}
        source={{ uri: paramUrl }}
        onLoadStart={() => setWebLoading(true)}
        onLoadEnd={()  => setWebLoading(false)}
        onNavigationStateChange={handleNavChange}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        style={{ flex: 1, opacity: webLoading ? 0 : 1 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1f1f1f' },
  closeBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  webLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', zIndex: 10 },

  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  overlayText: { fontSize: 15, color: '#555', marginTop: 16, textAlign: 'center' },
  backBtn:     { marginTop: 24, backgroundColor: '#6a0dad', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
