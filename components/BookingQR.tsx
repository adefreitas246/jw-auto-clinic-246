// components/BookingQR.tsx
// Fetches the signed QR payload from the server and renders it with
// react-native-qrcode-svg. Always sits on a white background so the
// QR scanner has guaranteed contrast regardless of device dark-mode.
//
// Install if not already present:
//   npx expo install react-native-qrcode-svg
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrData {
  payload:         string;
  bookingId:       string;
  serviceLabel:    string;
  appointmentDate: string;
  appointmentTime: string;
}

interface Props {
  bookingId: string;
  size?:     number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BookingQR({ bookingId, size = 220 }: Props) {
  const [qrData,  setQrData]  = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchQr = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<QrData>(`/api/bookings/${bookingId}/qr`);
      setQrData(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Could not load QR code.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { fetchQr(); }, [fetchQr]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={[q.shell, { width: size + 32, height: size + 32 }]}>
        <ActivityIndicator size="large" color="#6a0dad" />
      </View>
    );
  }

  // ── Error ──
  if (error || !qrData) {
    return (
      <View style={[q.shell, { width: size + 32, height: size + 32 }]}>
        <Ionicons name="alert-circle-outline" size={32} color="#c62828" />
        <Text style={q.errorText}>{error ?? 'QR unavailable'}</Text>
        <Pressable style={q.retryBtn} onPress={fetchQr}>
          <Text style={q.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ── QR ──
  return (
    <View style={q.qrWrap}>
      {/* White background guarantees scanner contrast */}
      <View style={[q.qrPad, { width: size + 32, height: size + 32 }]}>
        <QRCode
          value={qrData.payload}
          size={size}
          color="#1f1f1f"
          backgroundColor="white"
          quietZone={6}
        />
      </View>
      <Text style={q.hint}>
        Show this code to your wash technician when you arrive
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 6 },
}) ?? {};

const q = StyleSheet.create({
  shell: {
    backgroundColor: '#f5f5f5',
    borderRadius:    20,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
  },

  qrWrap: { alignItems: 'center', gap: 12 },

  qrPad: {
    backgroundColor: '#fff',
    borderRadius:    20,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW,
  },

  hint: {
    fontSize:   13,
    color:      '#888',
    textAlign:  'center',
    lineHeight: 18,
    maxWidth:   260,
  },

  errorText: {
    fontSize:   13,
    color:      '#c62828',
    textAlign:  'center',
    paddingHorizontal: 16,
  },

  retryBtn: {
    marginTop:       6,
    paddingHorizontal: 18,
    paddingVertical:  8,
    backgroundColor:  '#f3eafd',
    borderRadius:    999,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: '#6a0dad' },
});
