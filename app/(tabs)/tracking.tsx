// app/(tabs)/tracking.tsx — Staff GPS Tracking Screen
// Start / end shift with background location broadcasting.
// Monitors battery and reduces update frequency when below 15%.
import { Ionicons } from '@expo/vector-icons';
import * as Battery  from 'expo-battery';
import * as Location from 'expo-location';
import { router }    from 'expo-router';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth }         from '@/context/AuthContext';
import {
  TECHNICIAN_LOCATION_TASK,
  isLocationTaskRunning,
  startLocationTracking,
  stopLocationTracking,
} from '@/tasks/locationTask';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://jw-auto-clinic-246.onrender.com';

const LOW_BATTERY_THRESHOLD = 0.15; // 15 %

// ─── Battery bar ─────────────────────────────────────────────────────────────
function BatteryBar({ level }: { level: number }) {
  // level: 0.0–1.0, or -1 (unknown / simulator)
  const pct   = level === -1 ? null : Math.round(level * 100);
  const isLow = pct !== null && pct < 15;
  const color = isLow ? '#c62828' : pct !== null && pct < 30 ? '#e65100' : '#2e7d32';

  return (
    <View style={tr.batteryWrap}>
      <View style={tr.batteryBody}>
        <View
          style={[
            tr.batteryFill,
            {
              width:           `${pct ?? 0}%` as any,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <View style={tr.batteryNib} />
      <Text style={[tr.batteryText, { color }]}>
        {pct === null ? 'Unknown' : `${pct}%`}
      </Text>
    </View>
  );
}

// ─── Permission row ───────────────────────────────────────────────────────────
function PermRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <View style={tr.permRow}>
      <Ionicons
        name={granted ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={granted ? '#2e7d32' : '#c62828'}
      />
      <Text style={tr.permLabel}>{label}</Text>
      <Text style={[tr.permValue, { color: granted ? '#2e7d32' : '#c62828' }]}>
        {granted ? 'Granted' : 'Not granted'}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TrackingScreen() {
  const { user }                         = useAuth();
  const [tracking,     setTracking]      = useState(false);
  const [loading,      setLoading]       = useState(true);  // checking initial state
  const [actionBusy,   setActionBusy]    = useState(false);
  const [fgGranted,    setFgGranted]     = useState(false);
  const [bgGranted,    setBgGranted]     = useState(false);
  const [location,     setLocation]      = useState<Location.LocationObject | null>(null);
  const [batteryLevel, setBatteryLevel]  = useState<number>(-1);
  const [batteryState, setBatteryState]  = useState<Battery.BatteryState>(Battery.BatteryState.UNKNOWN);

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const batterySubRef = useRef<Battery.Subscription | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // ── Pulse animation for "live" dot ────────────────────────────────────────
  useEffect(() => {
    if (!tracking) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [tracking]);

  // ── Check permission + task state on mount ────────────────────────────────
  useEffect(() => {
    (async () => {
      const [fg, bg] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
      ]);
      setFgGranted(fg.status === 'granted');
      setBgGranted(bg.status === 'granted');

      const running = await isLocationTaskRunning();
      setTracking(running);
      setLoading(false);
    })();
  }, []);

  // ── Battery monitoring ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [level, state] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
      ]);
      setBatteryLevel(level);
      setBatteryState(state);
    })();

    batterySubRef.current = Battery.addBatteryLevelListener(({ batteryLevel: l }) => {
      setBatteryLevel(l);
      // If battery just crossed below the threshold while tracking, restart
      // the task at a reduced interval to preserve battery.
      if (l < LOW_BATTERY_THRESHOLD && l !== -1) {
        isLocationTaskRunning().then(running => {
          if (running && user) {
            startLocationTracking({ userId: user._id, apiUrl: API_URL, lowBattery: true })
              .catch(() => {});
          }
        });
      }
    });

    return () => { batterySubRef.current?.remove(); };
  }, [user]);

  // ── Foreground location subscription (for the "current position" card) ────
  useEffect(() => {
    if (!tracking || !fgGranted) {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      return;
    }

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5_000, distanceInterval: 10 },
      loc => setLocation(loc)
    ).then(sub => { locationSubRef.current = sub; });

    return () => {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, [tracking, fgGranted]);

  // ── Request permissions ───────────────────────────────────────────────────
  const requestPermissions = async (): Promise<boolean> => {
    // Step 1: foreground
    if (!fgGranted) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const ok = status === 'granted';
      setFgGranted(ok);
      if (!ok) {
        Alert.alert(
          'Permission Required',
          'Foreground location access is required to track your position.',
        );
        return false;
      }
    }

    // Step 2: background (needed for the task to fire when app is backgrounded)
    if (!bgGranted) {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      const ok = status === 'granted';
      setBgGranted(ok);
      if (!ok) {
        Alert.alert(
          'Background Location',
          'Background location was not granted. Tracking will only work while the app is open.',
        );
        // Continue anyway with foreground-only tracking
      }
    }

    return true;
  };

  // ── Start shift ───────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!user) return;
    const ok = await requestPermissions();
    if (!ok) return;

    setActionBusy(true);
    try {
      const isLow = batteryLevel !== -1 && batteryLevel < LOW_BATTERY_THRESHOLD;
      await startLocationTracking({ userId: user._id, apiUrl: API_URL, lowBattery: isLow });
      setTracking(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not start tracking.');
    } finally {
      setActionBusy(false);
    }
  };

  // ── End shift ─────────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (!user) return;
    Alert.alert(
      'End Shift',
      'Stop location tracking and go offline?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Shift',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            try {
              await stopLocationTracking({ userId: user._id, apiUrl: API_URL });
              setTracking(false);
              setLocation(null);
            } catch {
              // Best effort — still update local state
              setTracking(false);
              setLocation(null);
            } finally {
              setActionBusy(false);
            }
          },
        },
      ]
    );
  };

  const isLowBattery  = batteryLevel !== -1 && batteryLevel < LOW_BATTERY_THRESHOLD;
  const isCharging    = batteryState === Battery.BatteryState.CHARGING ||
                        batteryState === Battery.BatteryState.FULL;

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={tr.safe} edges={['top']}>
        <View style={tr.centered}>
          <Ionicons name="navigate-outline" size={48} color="#6a0dad" />
          <Text style={[tr.headerTitle, { marginTop: 12 }]}>Location Tracking</Text>
          <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 }}>
            GPS tracking is only available on the mobile app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={tr.centered}>
        <ActivityIndicator size="large" color="#6a0dad" />
      </View>
    );
  }

  return (
    <SafeAreaView style={tr.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={tr.header}>
        <Pressable style={tr.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1f1f1f" />
        </Pressable>
        <Text style={tr.headerTitle}>Location Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={tr.scroll}
        contentContainerStyle={tr.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status hero card ── */}
        <View style={[tr.heroCard, tracking ? tr.heroCardActive : tr.heroCardIdle]}>
          <View style={tr.heroRow}>
            {tracking ? (
              <Animated.View style={[tr.liveDot, { transform: [{ scale: pulseAnim }] }]} />
            ) : (
              <View style={[tr.liveDot, tr.liveDotOff]} />
            )}
            <Text style={[tr.heroStatus, { color: tracking ? '#2e7d32' : '#888' }]}>
              {tracking ? 'TRACKING ACTIVE' : 'NOT TRACKING'}
            </Text>
          </View>
          <Text style={tr.heroSub}>
            {tracking
              ? `Broadcasting every ${isLowBattery ? '60' : '15'} seconds`
              : 'Start your shift to begin broadcasting your location.'}
          </Text>
        </View>

        {/* ── Low battery warning ── */}
        {isLowBattery && !isCharging && (
          <View style={tr.warningBanner}>
            <Ionicons name="battery-dead-outline" size={18} color="#c62828" />
            <Text style={tr.warningText}>
              Battery below 15% — update interval reduced to 60 s to save power.
            </Text>
          </View>
        )}

        {/* ── Battery card ── */}
        <View style={tr.card}>
          <Text style={tr.cardTitle}>Battery</Text>
          <BatteryBar level={batteryLevel} />
          {isCharging && (
            <View style={tr.chargingRow}>
              <Ionicons name="flash" size={13} color="#2e7d32" />
              <Text style={tr.chargingText}>Charging</Text>
            </View>
          )}
        </View>

        {/* ── Permissions card ── */}
        <View style={tr.card}>
          <Text style={tr.cardTitle}>Permissions</Text>
          <PermRow label="Foreground location" granted={fgGranted} />
          <PermRow label="Background location" granted={bgGranted} />
          {!bgGranted && fgGranted && (
            <Pressable
              style={tr.grantBtn}
              onPress={async () => {
                const { status } = await Location.requestBackgroundPermissionsAsync();
                setBgGranted(status === 'granted');
              }}
            >
              <Text style={tr.grantBtnText}>Grant Background Permission</Text>
            </Pressable>
          )}
        </View>

        {/* ── Current position card (visible when tracking) ── */}
        {tracking && (
          <View style={tr.card}>
            <Text style={tr.cardTitle}>Current Position</Text>
            {location ? (
              <>
                <View style={tr.coordRow}>
                  <Ionicons name="location" size={16} color="#6a0dad" />
                  <Text style={tr.coordText}>
                    {location.coords.latitude.toFixed(6)}° N,{'  '}
                    {location.coords.longitude.toFixed(6)}° W
                  </Text>
                </View>
                <View style={tr.coordRow}>
                  <Ionicons name="radio-button-on" size={14} color="#888" />
                  <Text style={tr.coordSub}>
                    ±{Math.round(location.coords.accuracy ?? 0)} m accuracy
                  </Text>
                </View>
                <Text style={tr.updatedAt}>
                  Updated {new Date(location.timestamp).toLocaleTimeString()}
                </Text>
              </>
            ) : (
              <View style={tr.locWaiting}>
                <ActivityIndicator size="small" color="#6a0dad" />
                <Text style={tr.locWaitingText}>Acquiring GPS signal…</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Main CTA ── */}
        {tracking ? (
          <Pressable
            style={({ pressed }) => [
              tr.endBtn,
              pressed    && { opacity: 0.85 },
              actionBusy && { opacity: 0.6  },
            ]}
            onPress={handleStop}
            disabled={actionBusy}
          >
            {actionBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="stop-circle" size={20} color="#fff" />
                <Text style={tr.endBtnText}>End Shift</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              tr.startBtn,
              pressed    && { opacity: 0.88 },
              actionBusy && { opacity: 0.6  },
            ]}
            onPress={handleStart}
            disabled={actionBusy}
          >
            {actionBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={tr.startBtnText}>Start Shift</Text>
              </>
            )}
          </Pressable>
        )}

        {/* ── Info note ── */}
        <View style={tr.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color="#888" />
          <Text style={tr.infoText}>
            Keep the app running in the background for uninterrupted tracking. Customers
            assigned to mobile jobs will see your live position on their map.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const SHADOW = Platform.select({
  ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const tr = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  scroll:  { flex: 1 },
  content: { paddingBottom: 48 },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1f1f1f' },

  // Hero card
  heroCard: {
    marginHorizontal: 16, borderRadius: 16, padding: 20,
    marginBottom: 14, ...SHADOW,
  },
  heroCardActive: { backgroundColor: '#e8f5e9' },
  heroCardIdle:   { backgroundColor: '#fff' },
  heroRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  liveDot:   { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2e7d32' },
  liveDotOff:{ backgroundColor: '#bbb' },
  heroStatus:{ fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  heroSub:   { fontSize: 13, color: '#555', lineHeight: 18 },

  // Warning banner
  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fff3e0', borderRadius: 12, padding: 14,
    marginHorizontal: 16, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#c62828',
  },
  warningText: { flex: 1, fontSize: 13, color: '#c62828', fontWeight: '600', lineHeight: 18 },

  // Generic card
  card: {
    backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 16, padding: 18, marginBottom: 14, ...SHADOW,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1f1f1f', marginBottom: 14 },

  // Battery bar
  batteryWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  batteryBody:  { flex: 1, height: 16, backgroundColor: '#f0f0f0', borderRadius: 8, overflow: 'hidden' },
  batteryFill:  { height: '100%', borderRadius: 8 },
  batteryNib:   { width: 4, height: 8, backgroundColor: '#ccc', borderRadius: 2 },
  batteryText:  { fontSize: 14, fontWeight: '700', minWidth: 44 },
  chargingRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  chargingText: { fontSize: 12, color: '#2e7d32', fontWeight: '600' },

  // Permissions
  permRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  permLabel: { flex: 1, fontSize: 14, color: '#555' },
  permValue: { fontSize: 13, fontWeight: '700' },
  grantBtn:  {
    marginTop: 6, backgroundColor: '#f3eafd', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  grantBtnText: { color: '#6a0dad', fontSize: 13, fontWeight: '700' },

  // Coordinates
  coordRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  coordText:   { fontSize: 14, fontWeight: '600', color: '#1f1f1f', flex: 1 },
  coordSub:    { fontSize: 12, color: '#888' },
  updatedAt:   { fontSize: 12, color: '#aaa', marginTop: 6 },
  locWaiting:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  locWaitingText:{ fontSize: 13, color: '#888' },

  // Buttons
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6a0dad', borderRadius: 14, paddingVertical: 16,
    marginHorizontal: 16, marginBottom: 14, ...SHADOW,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#c62828', borderRadius: 14, paddingVertical: 16,
    marginHorizontal: 16, marginBottom: 14, ...SHADOW,
  },
  endBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Info note
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: '#aaa', lineHeight: 18 },
});
