// app/(customer)/book/confirmed.tsx — Step 7: Booking confirmed
// • Requests push permission if not already granted
// • Saves Expo push token to backend
// • Schedules a local reminder 1 hour before the appointment
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import { useBooking } from '@/context/BookingContext';
import { Colors } from '@/constants/Colors';

// expo-notifications ships DevicePushTokenAutoRegistration.fx.js which runs as
// a module-load side-effect and crashes in Expo Go SDK 53+.
// Using a lazy require() defers module evaluation until the function is called,
// so the side-effect never fires when running inside Expo Go.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

function getNotifications() {
  return require('expo-notifications') as typeof import('expo-notifications');
}

if (!IS_EXPO_GO) {
  getNotifications().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });
}

async function registerPushToken(): Promise<string | null> {
  if (IS_EXPO_GO) return null;
  const Notifications = getNotifications();
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
        lightColor: Colors.accent,
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
  if (IS_EXPO_GO) return;
  const Notifications = getNotifications();
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
          <Ionicons name="checkmark" size={56} color={Colors.white} />
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
            color={notifStatus === 'granted' ? Colors.success : Colors.textMuted}
          />
          <Text style={[s.notifText, notifStatus === 'granted' ? { color: Colors.success } : { color: Colors.textMuted }]}>
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
              <Ionicons name={row.icon as any} size={16} color={Colors.accent} />
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
                <Ionicons name="qr-code-outline" size={16} color={Colors.white} />
                <Text style={[s.trackBtnText, { color: Colors.white }]}>View Check-In QR</Text>
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
                <Ionicons name="navigate" size={16} color={Colors.accent} />
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
  safe:      { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },

  checkCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios:     { shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  title:     { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  sub:       { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  highlight: { color: Colors.accent, fontWeight: '700' },

  notifBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 24 },
  notifGranted: { backgroundColor: '#e8f5e9' },
  notifDenied:  { backgroundColor: Colors.background },
  notifText:    { fontSize: 13, fontWeight: '600' },

  summaryCard: { width: '100%', backgroundColor: '#f7f7fb', borderRadius: 14, padding: 16, gap: 10, marginBottom: 28 },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { fontSize: 14, color: Colors.textPrimary },

  actions: { width: '100%', gap: 10 },
  qrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14,
  },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#f3eafd', borderRadius: 14, paddingVertical: 14,
  },
  trackBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  doneBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  doneBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
