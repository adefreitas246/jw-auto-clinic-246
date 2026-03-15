// app/(customer)/book/confirmed.tsx — Step 7: Booking confirmed
// • Requests push permission if not already granted
// • Saves Expo push token to backend
// • Schedules a local reminder 1 hour before the appointment
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import { useBooking } from '@/context/BookingContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

async function registerPushToken(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bookings', {
        name:       'Booking Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6a0dad',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch (err) {
    console.warn('[Push] Could not get push token:', err);
    return null;
  }
}

async function scheduleReminder(appointmentDate: string, appointmentTime: string, serviceLabel: string): Promise<void> {
  try {
    const [y, m, d]    = appointmentDate.split('-').map(Number);
    const [hr, min]    = appointmentTime.split(':').map(Number);
    const apptMs       = new Date(y, m - 1, d, hr, min, 0).getTime();
    const reminderMs   = apptMs - 60 * 60 * 1000; // 1 hour before
    const secondsUntil = Math.floor((reminderMs - Date.now()) / 1000);

    if (secondsUntil <= 0) return; // appointment already passed

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Appointment in 1 hour',
        body:  `Your ${serviceLabel} is coming up at ${appointmentTime}. Get ready!`,
        sound: 'default',
        data:  { type: 'booking_reminder' },
      },
      trigger: { seconds: secondsUntil, channelId: 'bookings' } as any,
    });
  } catch (err) {
    console.warn('[Push] Could not schedule reminder:', err);
  }
}

export default function BookConfirmedStep() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { draft, reset } = useBooking();
  const [notifStatus, setNotifStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  // Scale-in animation for the checkmark
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, bounciness: 14, useNativeDriver: true }).start();

    (async () => {
      const token = await registerPushToken();
      if (token) {
        setNotifStatus('granted');
        // Save token to backend
        try { await axios.post('/api/bookings/push-token', { token }); } catch {}
        // Schedule local reminder
        if (draft.appointmentDate && draft.appointmentTime) {
          await scheduleReminder(draft.appointmentDate, draft.appointmentTime, draft.serviceLabel ?? draft.selectedPackage?.name ?? 'your appointment');
        }
      } else {
        setNotifStatus('denied');
      }
    })();
  }, []);

  const handleDone = () => {
    reset();
    router.replace('/(customer)/home');
  };

  const handleViewBookings = () => {
    reset();
    // Navigate to bookings list (can be built later; fall back to home for now)
    router.replace('/(customer)/home');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.container}>

        {/* Animated check */}
        <Animated.View style={[s.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark" size={56} color="#fff" />
        </Animated.View>

        <Text style={s.title}>Booking Confirmed!</Text>
        <Text style={s.sub}>
          Your {draft.selectedPackage?.name ?? 'service'} is booked for{'\n'}
          <Text style={s.highlight}>{draft.appointmentDate}</Text>
          {' at '}
          <Text style={s.highlight}>{draft.appointmentTime}</Text>
        </Text>

        {/* Notification status */}
        <View style={[s.notifBadge, notifStatus === 'granted' ? s.notifGranted : s.notifDenied]}>
          <Ionicons
            name={notifStatus === 'granted' ? 'notifications' : 'notifications-off-outline'}
            size={16}
            color={notifStatus === 'granted' ? '#0a8f3c' : '#888'}
          />
          <Text style={[s.notifText, notifStatus === 'granted' ? { color: '#0a8f3c' } : { color: '#888' }]}>
            {notifStatus === 'pending'  && 'Setting up reminder…'}
            {notifStatus === 'granted'  && 'Reminder set for 1 hour before'}
            {notifStatus === 'denied'   && 'Enable notifications to get reminders'}
          </Text>
        </View>

        {/* Summary pill */}
        <View style={s.summaryCard}>
          {[
            { icon: 'layers',   label: draft.selectedPackage?.name ?? 'Custom service' },
            { icon: 'location', label: draft.locationType === 'bay' ? (draft.bay?.label ?? 'Bay service') : 'Mobile service' },
            { icon: 'cash',     label: `${draft.paymentMethod.toUpperCase()} · $${draft.totalPrice.toFixed(2)}` },
          ].map(row => (
            <View key={row.label} style={s.summaryRow}>
              <Ionicons name={row.icon as any} size={16} color="#6a0dad" />
              <Text style={s.summaryText}>{row.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.actions}>
          {bookingId ? (
            <>
              <Pressable
                style={s.qrBtn}
                onPress={() => {
                  reset();
                  router.replace({
                    pathname: '/(customer)/booking/[id]',
                    params:   { id: bookingId },
                  });
                }}
              >
                <Ionicons name="qr-code-outline" size={16} color="#fff" />
                <Text style={[s.trackBtnText, { color: '#fff' }]}>View Check-In QR</Text>
              </Pressable>
              <Pressable
                style={s.trackBtn}
                onPress={() => {
                  reset();
                  router.replace({
                    pathname: '/(customer)/track/[id]',
                    params:   { id: bookingId },
                  });
                }}
              >
                <Ionicons name="navigate" size={16} color="#6a0dad" />
                <Text style={s.trackBtnText}>Track My Job</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable style={s.doneBtn} onPress={handleDone}>
            <Text style={s.doneBtnText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },

  checkCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#6a0dad', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  title:     { fontSize: 26, fontWeight: '800', color: '#1f1f1f', marginBottom: 10 },
  sub:       { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  highlight: { color: '#6a0dad', fontWeight: '700' },

  notifBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 24 },
  notifGranted: { backgroundColor: '#e8f5e9' },
  notifDenied:  { backgroundColor: '#f5f5f5' },
  notifText:    { fontSize: 13, fontWeight: '600' },

  summaryCard: { width: '100%', backgroundColor: '#f7f7fb', borderRadius: 14, padding: 16, gap: 10, marginBottom: 28 },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { fontSize: 14, color: '#333' },

  actions: { width: '100%', gap: 10 },
  qrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6a0dad', borderRadius: 14, paddingVertical: 14,
  },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#f3eafd', borderRadius: 14, paddingVertical: 14,
  },
  trackBtnText: { color: '#6a0dad', fontSize: 15, fontWeight: '700' },
  doneBtn: { backgroundColor: '#6a0dad', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
