// app/(tabs)/tracking.tsx — Staff GPS Tracking Screen
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
  isLocationTaskRunning,
  startLocationTracking,
  stopLocationTracking,
} from '@/tasks/locationTask';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://jw-auto-clinic-246.onrender.com';

const LOW_BATTERY_THRESHOLD = 0.15;

// ─── Battery bar ─────────────────────────────────────────────────────────────

function BatteryBar({ level }: { level: number }) {
  const pct   = level === -1 ? null : Math.round(level * 100);
  const isLow = pct !== null && pct < 15;
  const color = isLow ? Colors.error : pct !== null && pct < 30 ? Colors.warning : Colors.success;

  return (
    <View style={tr.batteryWrap}>
      <View style={tr.batteryBody}>
        <View
          style={[
            tr.batteryFill,
            { width: `${pct ?? 0}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <View style={[tr.batteryNib, { backgroundColor: color }]} />
      <Text style={[tr.batteryPct, { color }]}>
        {pct === null ? 'Unknown' : `${pct}%`}
      </Text>
    </View>
  );
}

// ─── Permission row ───────────────────────────────────────────────────────────

function PermRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <View style={tr.permRow}>
      <View style={[tr.permDot, { backgroundColor: granted ? Colors.success : Colors.border }]} />
      <Text style={tr.permLabel}>{label}</Text>
      <Text style={[tr.permValue, { color: granted ? Colors.success : Colors.error }]}>
        {granted ? 'Granted' : 'Not granted'}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TrackingScreen() {
  const { user }                         = useAuth();
  const [tracking,     setTracking]      = useState(false);
  const [loading,      setLoading]       = useState(true);
  const [actionBusy,   setActionBusy]    = useState(false);
  const [fgGranted,    setFgGranted]     = useState(false);
  const [bgGranted,    setBgGranted]     = useState(false);
  const [location,     setLocation]      = useState<Location.LocationObject | null>(null);
  const [batteryLevel, setBatteryLevel]  = useState<number>(-1);
  const [batteryState, setBatteryState]  = useState<Battery.BatteryState>(Battery.BatteryState.UNKNOWN);

  const pulseAnim      = useRef(new Animated.Value(1)).current;
  const batterySubRef  = useRef<Battery.Subscription | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // Pulse animation for live dot
  useEffect(() => {
    if (!tracking) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [tracking]);

  // Check permission + task state on mount
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

  // Battery monitoring
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
      if (l < LOW_BATTERY_THRESHOLD && l !== -1) {
        isLocationTaskRunning().then(running => {
          if (running && user) {
            startLocationTracking({ userId: user._id, apiUrl: API_URL, lowBattery: true }).catch(() => {});
          }
        });
      }
    });

    return () => { batterySubRef.current?.remove(); };
  }, [user]);

  // Foreground location subscription
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

  const requestPermissions = async (): Promise<boolean> => {
    if (!fgGranted) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const ok = status === 'granted';
      setFgGranted(ok);
      if (!ok) {
        Alert.alert('Permission Required', 'Foreground location access is required to track your position.');
        return false;
      }
    }
    if (!bgGranted) {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      const ok = status === 'granted';
      setBgGranted(ok);
      if (!ok) {
        Alert.alert('Background Location', 'Background location was not granted. Tracking will only work while the app is open.');
      }
    }
    return true;
  };

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

  const handleStop = async () => {
    if (!user) return;
    Alert.alert('End Shift', 'Stop location tracking and go offline?', [
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
            setTracking(false);
            setLocation(null);
          } finally {
            setActionBusy(false);
          }
        },
      },
    ]);
  };

  const isLowBattery = batteryLevel !== -1 && batteryLevel < LOW_BATTERY_THRESHOLD;
  const isCharging   = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={tr.safe} edges={['top']}>
        <View style={tr.centered}>
          <View style={tr.webIconWrap}>
            <Ionicons name="navigate-outline" size={36} color={Colors.accent} />
          </View>
          <Text style={tr.webTitle}>Location Tracking</Text>
          <Text style={tr.webSub}>GPS tracking is only available on the mobile app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={tr.safe} edges={['top']}>
        <View style={tr.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={tr.safe} edges={['top']}>
      {/* Header */}
      <View style={tr.header}>
        <Pressable style={tr.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={tr.headerTitle}>Location Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={tr.scroll}
        contentContainerStyle={tr.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status hero card */}
        <View style={[tr.heroCard, tracking ? tr.heroActive : tr.heroIdle]}>
          <View style={tr.heroRow}>
            <Animated.View style={[
              tr.liveDot,
              tracking ? tr.liveDotOn : tr.liveDotOff,
              tracking && { transform: [{ scale: pulseAnim }] },
            ]} />
            <View>
              <Text style={[tr.heroStatus, { color: tracking ? Colors.success : Colors.textMuted }]}>
                {tracking ? 'TRACKING ACTIVE' : 'NOT TRACKING'}
              </Text>
              <Text style={tr.heroSub}>
                {tracking
                  ? `Broadcasting every ${isLowBattery ? '60' : '15'} seconds`
                  : 'Start your shift to begin broadcasting your location.'}
              </Text>
            </View>
          </View>
          {tracking && (
            <View style={tr.shiftBadge}>
              <Ionicons name="radio" size={11} color={Colors.success} />
              <Text style={tr.shiftBadgeText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Low battery warning */}
        {isLowBattery && !isCharging && (
          <View style={tr.warningBanner}>
            <Ionicons name="battery-dead-outline" size={18} color={Colors.warningText} />
            <Text style={tr.warningText}>
              Battery below 15% — update interval reduced to 60 s to save power.
            </Text>
          </View>
        )}

        {/* Battery card */}
        <View style={tr.card}>
          <View style={tr.cardTitleRow}>
            <Ionicons name="battery-half-outline" size={16} color={Colors.textMuted} />
            <Text style={tr.cardTitle}>Battery</Text>
          </View>
          <BatteryBar level={batteryLevel} />
          {isCharging && (
            <View style={tr.chargingRow}>
              <Ionicons name="flash" size={12} color={Colors.success} />
              <Text style={tr.chargingText}>Charging</Text>
            </View>
          )}
        </View>

        {/* Permissions card */}
        <View style={tr.card}>
          <View style={tr.cardTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textMuted} />
            <Text style={tr.cardTitle}>Permissions</Text>
          </View>
          <PermRow label="Foreground location" granted={fgGranted} />
          <PermRow label="Background location" granted={bgGranted} />
          {!bgGranted && fgGranted && (
            <Pressable
              style={tr.grantBtn}
              onPress={async () => {
                const { status } = await Location.requestBackgroundPermissionsAsync();
                setBgGranted(status === 'granted');
              }}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Text style={tr.grantBtnText}>Grant Background Permission</Text>
            </Pressable>
          )}
        </View>

        {/* Current position card */}
        {tracking && (
          <View style={tr.card}>
            <View style={tr.cardTitleRow}>
              <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
              <Text style={tr.cardTitle}>Current Position</Text>
            </View>
            {location ? (
              <>
                <View style={tr.coordRow}>
                  <View style={tr.coordIconWrap}>
                    <Ionicons name="location" size={14} color={Colors.accent} />
                  </View>
                  <Text style={tr.coordText}>
                    {location.coords.latitude.toFixed(6)}°,{'  '}
                    {location.coords.longitude.toFixed(6)}°
                  </Text>
                </View>
                <View style={tr.coordSubRow}>
                  <Ionicons name="radio-button-on" size={12} color={Colors.textMuted} />
                  <Text style={tr.coordSub}>
                    ±{Math.round(location.coords.accuracy ?? 0)} m accuracy
                  </Text>
                  <View style={tr.coordDot} />
                  <Text style={tr.coordSub}>
                    {new Date(location.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </>
            ) : (
              <View style={tr.locWaiting}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={tr.locWaitingText}>Acquiring GPS signal…</Text>
              </View>
            )}
          </View>
        )}

        {/* Main CTA */}
        {tracking ? (
          <Pressable
            style={({ pressed }) => [tr.endBtn, pressed && { opacity: 0.85 }, actionBusy && { opacity: 0.6 }]}
            onPress={handleStop}
            disabled={actionBusy}
            android_ripple={{ color: Colors.accent + '12', borderless: false }}
          >
            {actionBusy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="stop-circle" size={20} color={Colors.white} />
                <Text style={tr.endBtnText}>End Shift</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [tr.startBtn, pressed && { opacity: 0.88 }, actionBusy && { opacity: 0.6 }]}
            onPress={handleStart}
            disabled={actionBusy}
            android_ripple={{ color: Colors.accent + '12', borderless: false }}
          >
            {actionBusy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color={Colors.white} />
                <Text style={tr.startBtnText}>Start Shift</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Info note */}
        <View style={tr.infoBox}>
          <Ionicons name="information-circle-outline" size={15} color={Colors.textMuted} />
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

const tr = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },

  // Web fallback
  webIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  webTitle:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  webSub:      { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },

  // Hero card
  heroCard: {
    borderRadius: borderRadius.lg, padding: 20, marginBottom: 12, ...cardShadow,
  },
  heroActive: { backgroundColor: Colors.successBg },
  heroIdle:   { backgroundColor: Colors.surface },
  heroRow:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  liveDot:    { width: 14, height: 14, borderRadius: 7 },
  liveDotOn:  { backgroundColor: Colors.success },
  liveDotOff: { backgroundColor: Colors.border },
  heroStatus: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  heroSub:    { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 2, maxWidth: 220 },
  shiftBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Colors.success + '18', borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  shiftBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.success, letterSpacing: 0.8 },

  // Warning banner
  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.warningBg, borderRadius: borderRadius.md, padding: 14,
    marginBottom: 12, borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  warningText: { flex: 1, fontSize: 13, color: Colors.warningText, fontWeight: '600', lineHeight: 18 },

  // Generic card
  card: {
    backgroundColor: Colors.surface, borderRadius: borderRadius.md,
    padding: 16, marginBottom: 12, ...cardShadow,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  cardTitle:    { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  // Battery bar
  batteryWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batteryBody:  { flex: 1, height: 14, backgroundColor: Colors.surfaceAlt, borderRadius: 7, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  batteryFill:  { height: '100%', borderRadius: 7 },
  batteryNib:   { width: 4, height: 8, borderRadius: 2 },
  batteryPct:   { fontSize: 14, fontWeight: '700', minWidth: 44 },
  chargingRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  chargingText: { fontSize: 12, color: Colors.success, fontWeight: '600' },

  // Permissions
  permRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  permDot:   { width: 8, height: 8, borderRadius: 4 },
  permLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  permValue: { fontSize: 12, fontWeight: '700' },
  grantBtn:  {
    marginTop: 4, backgroundColor: Colors.accentMuted, borderRadius: borderRadius.sm,
    paddingVertical: 10, alignItems: 'center',
  },
  grantBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },

  // Coordinates
  coordRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  coordIconWrap:{ width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  coordText:    { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  coordSubRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordSub:     { fontSize: 12, color: Colors.textMuted },
  coordDot:     { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  locWaiting:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  locWaitingText:{ fontSize: 13, color: Colors.textMuted },

  // Buttons
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingVertical: 16,
    marginBottom: 12, ...cardShadow,
  },
  startBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.error, borderRadius: borderRadius.md, paddingVertical: 16,
    marginBottom: 12, ...cardShadow,
  },
  endBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  // Info note
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
});
