// app/(customer)/book/confirmed.tsx — Step 7: Booking confirmed
// • Requests push permission if not already granted
// • Saves Expo push token to backend
// • Schedules a local reminder 1 hour before the appointment
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useBooking } from '@/context/BookingContext';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

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

    if (!IS_IOS) {
      await Notifications.setNotificationChannelAsync('bookings', {
        name:             'Booking Reminders',
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       Colors.accent,
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

async function scheduleReminder(
  appointmentDate: string,
  appointmentTime: string,
  serviceLabel: string,
): Promise<void> {
  if (IS_EXPO_GO) return;
  const Notifications = getNotifications();
  try {
    const [y, m, d]    = appointmentDate.split('-').map(Number);
    const [hr, min]    = appointmentTime.split(':').map(Number);
    const apptMs       = new Date(y, m - 1, d, hr, min, 0).getTime();
    const reminderMs   = apptMs - 60 * 60 * 1000; // 1 hour before
    const secondsUntil = Math.floor((reminderMs - Date.now()) / 1000);

    if (secondsUntil <= 0) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Appointment in 1 hour',
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
  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate check circle in, then fade in content
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, bounciness: 16, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    (async () => {
      const token = await registerPushToken();
      if (token) {
        setNotifStatus('granted');
        try { await axios.post('/api/bookings/push-token', { token }); } catch {}
        if (draft.appointmentDate && draft.appointmentTime) {
          await scheduleReminder(
            draft.appointmentDate,
            draft.appointmentTime,
            draft.serviceLabel ?? draft.selectedPackage?.name ?? 'your appointment',
          );
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
    router.replace('/(customer)/home');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.container}>

        {/* Animated check circle */}
        <Animated.View style={[s.checkCircleOuter, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.checkCircleInner}>
            <Ionicons name="checkmark" size={52} color={Colors.white} />
          </View>
        </Animated.View>

        <Animated.View style={[s.textBlock, { opacity: fadeAnim }]}>
          <Text style={s.title}>Booking Confirmed!</Text>
          <Text style={s.sub}>
            Your{' '}
            <Text style={s.highlight}>{draft.selectedPackage?.name ?? 'service'}</Text>
            {' '}is booked for{'\n'}
            <Text style={s.highlight}>{draft.appointmentDate}</Text>
            {'  at  '}
            <Text style={s.highlight}>{draft.appointmentTime}</Text>
          </Text>
        </Animated.View>

        {/* Notification status badge */}
        <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
          <View style={[
            s.notifBadge,
            notifStatus === 'granted' ? s.notifBadgeGranted : s.notifBadgeDenied,
          ]}>
            <Ionicons
              name={notifStatus === 'granted' ? 'notifications-outline' : 'notifications-off-outline'}
              size={15}
              color={notifStatus === 'granted' ? Colors.successText : Colors.textMuted}
            />
            <Text style={[
              s.notifText,
              notifStatus === 'granted' ? s.notifTextGranted : s.notifTextDenied,
            ]}>
              {notifStatus === 'pending' && 'Setting up reminder…'}
              {notifStatus === 'granted' && 'Reminder set for 1 hour before'}
              {notifStatus === 'denied'  && 'Enable notifications to get reminders'}
            </Text>
          </View>

          {/* Summary card */}
          <View style={s.summaryCard}>
            {[
              {
                icon: 'layers-outline' as const,
                label: 'Service',
                value: draft.selectedPackage?.name ?? 'Custom service',
              },
              {
                icon: 'location-outline' as const,
                label: 'Location',
                value: draft.locationType === 'bay'
                  ? (draft.bay?.label ?? 'Bay service')
                  : 'Mobile service',
              },
              {
                icon: 'cash-outline' as const,
                label: 'Payment',
                value: `${draft.paymentMethod.toUpperCase()}  ·  $${draft.totalPrice.toFixed(2)}`,
              },
            ].map((row, i, arr) => (
              <View key={row.label} style={[s.summaryRow, i < arr.length - 1 && s.summaryRowBorder]}>
                <View style={s.summaryIconWrap}>
                  <Ionicons name={row.icon} size={16} color={Colors.accent} />
                </View>
                <View style={s.summaryTextWrap}>
                  <Text style={s.summaryRowLabel}>{row.label}</Text>
                  <Text style={s.summaryRowValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={s.actions}>
            {bookingId ? (
              <>
                <Pressable
                  style={s.qrBtn}
                  onPress={() => {
                    reset();
                    router.replace({ pathname: '/(customer)/booking/[id]', params: { id: bookingId } });
                  }}
                  android_ripple={{ color: Colors.accent + '12', borderless: false }}
                >
                  <Ionicons name="qr-code-outline" size={18} color={Colors.white} />
                  <Text style={s.qrBtnText}>View Check-In QR</Text>
                </Pressable>

                <Pressable
                  style={s.trackBtn}
                  onPress={() => {
                    reset();
                    router.replace({ pathname: '/(customer)/track/[id]', params: { id: bookingId } });
                  }}
                  android_ripple={{ color: Colors.accent + '12', borderless: false }}
                >
                  <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
                  <Text style={s.trackBtnText}>Track My Job</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              style={({ pressed }) => [s.doneBtn, pressed && { opacity: 0.88 }]}
              onPress={handleDone}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Text style={s.doneBtnText}>Back to Home</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.surface },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 24,
  },

  // Check circle
  checkCircleOuter: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkCircleInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_IOS
      ? { shadowColor: Colors.accent, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 12 }),
  },

  textBlock: { alignItems: 'center', marginBottom: 20, width: '100%' },
  title:     { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  sub:       { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  highlight: { color: Colors.accent, fontWeight: '700' },

  // Notif badge
  notifBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 20,
  },
  notifBadgeGranted: { backgroundColor: Colors.successBg },
  notifBadgeDenied:  { backgroundColor: Colors.background },
  notifText:         { fontSize: 13, fontWeight: '600' },
  notifTextGranted:  { color: Colors.successText },
  notifTextDenied:   { color: Colors.textMuted },

  // Summary card
  summaryCard: {
    width: '100%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: 24,
    ...cardShadow,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  summaryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextWrap:  { flex: 1 },
  summaryRowLabel:  { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRowValue:  { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginTop: 1 },

  // Actions
  actions: { width: '100%', gap: 10 },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
  },
  qrBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  trackBtnText:{ color: Colors.accent, fontSize: 15, fontWeight: '700' },
  doneBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  doneBtnText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
