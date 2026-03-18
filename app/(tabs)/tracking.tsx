// app/(tabs)/tracking.tsx — Staff GPS Tracking (full screen map)
import { Ionicons } from '@expo/vector-icons';
import * as Battery  from 'expo-battery';
import * as Location from 'expo-location';
import { router }    from 'expo-router';
import axios         from 'axios';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth }             from '@/context/AuthContext';
import { isLocationTaskRunning } from '@/tasks/locationTask';
import { Colors }              from '@/constants/Colors';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

const LOCATION_TASK = 'STAFF_LOCATION';
const LOW_BATTERY   = 0.15;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CurrentJob {
  _id:               string;
  customerName?:     string;
  serviceName?:      string;
  serviceLabel?:     string;
  address?:          string;
  lat?:              number;
  lng?:              number;
  estimatedDuration?: number;
  status?:           string;
}

interface NextJob {
  _id:             string;
  appointmentTime: string;
  address?:        string;
  minutesAway?:    number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(startMs: number): string {
  const s = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function openNavigation(address?: string, lat?: number, lng?: number) {
  const dest = lat && lng
    ? `${lat},${lng}`
    : encodeURIComponent(address ?? '');
  const url = Platform.OS === 'ios'
    ? `maps://?daddr=${dest}`
    : `https://maps.google.com/maps?daddr=${dest}`;
  Linking.openURL(url).catch(() => {});
}

// ── Battery warning banner ────────────────────────────────────────────────────

function BatteryWarning() {
  return (
    <View style={bw.banner}>
      <Ionicons name="battery-dead-outline" size={16} color={Colors.warningText} />
      <Text style={bw.text}>Low battery — location updates may stop</Text>
    </View>
  );
}

const bw = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warningBg,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.warning,
  },
  text: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.warningText },
});

// ── Shift status banner ───────────────────────────────────────────────────────

function ShiftBanner({
  shiftActive,
  startMs,
  actionBusy,
  onStart,
  onEnd,
}: {
  shiftActive: boolean;
  startMs:     number | null;
  actionBusy:  boolean;
  onStart:     () => void;
  onEnd:       () => void;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!shiftActive) return;
    const id = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, [shiftActive]);

  if (shiftActive) {
    return (
      <View style={[sb.card, sb.cardActive]}>
        <View style={sb.dot} />
        <View style={{ flex: 1 }}>
          <Text style={sb.activeLabel}>Shift Active</Text>
          {startMs && (
            <Text style={sb.duration}>{formatElapsed(startMs)}</Text>
          )}
        </View>
        <Pressable
          style={[sb.endBtn, actionBusy && { opacity: 0.6 }]}
          onPress={onEnd}
          disabled={actionBusy}
          android_ripple={{ color: Colors.errorText, borderless: false }}
        >
          {actionBusy
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={sb.endBtnText}>End Shift</Text>
          }
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[sb.card, sb.cardIdle]}>
      <Ionicons name="navigate-outline" size={18} color={Colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={sb.idleLabel}>Shift not started</Text>
        <Text style={sb.idleSub}>Start to broadcast your location</Text>
      </View>
      <Pressable
        style={[sb.startBtn, actionBusy && { opacity: 0.6 }]}
        onPress={onStart}
        disabled={actionBusy}
        android_ripple={{ color: Colors.accentDark, borderless: false }}
      >
        {actionBusy
          ? <ActivityIndicator size="small" color={Colors.white} />
          : <Text style={sb.startBtnText}>Start Shift</Text>
        }
      </Pressable>
    </View>
  );
}

const sb = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: borderRadius.xl,
    paddingVertical: 14, paddingHorizontal: 16,
    ...cardShadow,
  },
  cardActive: { backgroundColor: Colors.successBg, borderWidth: 1, borderColor: Colors.success + '50' },
  cardIdle:   { backgroundColor: Colors.surface,   borderWidth: 1, borderColor: Colors.border },

  dot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  activeLabel: { fontSize: 14, fontWeight: '700', color: Colors.success },
  duration:    { fontSize: 12, color: Colors.successText, marginTop: 1 },
  idleLabel:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  idleSub:     { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  startBtn: {
    backgroundColor: Colors.accent, borderRadius: borderRadius.full,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 90,
    alignItems: 'center', overflow: 'hidden',
  },
  startBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  endBtn: {
    backgroundColor: Colors.error, borderRadius: borderRadius.full,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 90,
    alignItems: 'center', overflow: 'hidden',
  },
  endBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});

// ── Next job preview ──────────────────────────────────────────────────────────

function NextJobPreview({ job }: { job: NextJob }) {
  return (
    <View style={nj.card}>
      <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={nj.label}>Next up · {job.appointmentTime}</Text>
        {job.address ? (
          <Text style={nj.address} numberOfLines={1}>{job.address}</Text>
        ) : null}
      </View>
      {job.minutesAway != null && (
        <Text style={nj.eta}>{job.minutesAway} min away</Text>
      )}
    </View>
  );
}

const nj = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  label:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  address: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  eta:     { fontSize: 12, fontWeight: '700', color: Colors.accent },
});

// ── Current job card ──────────────────────────────────────────────────────────

function CurrentJobCard({
  job,
  onMarkArrived,
  arrivedBusy,
}: {
  job:           CurrentJob | null;
  onMarkArrived: () => void;
  arrivedBusy:   boolean;
}) {
  if (!job) {
    return (
      <View style={cj.emptyCard}>
        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
        <Text style={cj.emptyText}>No active job — check your schedule</Text>
      </View>
    );
  }

  const service = job.serviceName ?? job.serviceLabel ?? '—';

  return (
    <View style={cj.card}>
      {/* Header */}
      <View style={cj.headerRow}>
        <View style={cj.iconWrap}>
          <Ionicons name="car-outline" size={18} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cj.customerName}>{job.customerName ?? 'Customer'}</Text>
          <Text style={cj.serviceName}>{service}</Text>
        </View>
        {job.estimatedDuration ? (
          <View style={cj.etaBadge}>
            <Text style={cj.etaText}>{job.estimatedDuration}m</Text>
          </View>
        ) : null}
      </View>

      {/* Address */}
      {job.address ? (
        <View style={cj.addressRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={cj.addressText} numberOfLines={2}>{job.address}</Text>
        </View>
      ) : null}

      {/* Buttons */}
      <View style={cj.btnRow}>
        <Pressable
          style={cj.navBtn}
          onPress={() => openNavigation(job.address, job.lat, job.lng)}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Ionicons name="navigate" size={15} color={Colors.accent} />
          <Text style={cj.navBtnText}>Navigate</Text>
        </Pressable>

        <Pressable
          style={[cj.arrivedBtn, arrivedBusy && { opacity: 0.65 }]}
          onPress={onMarkArrived}
          disabled={arrivedBusy}
          android_ripple={{ color: Colors.accentDark, borderless: false }}
        >
          {arrivedBusy
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <>
                <Ionicons name="checkmark-circle-outline" size={15} color={Colors.white} />
                <Text style={cj.arrivedBtnText}>Mark Arrived</Text>
              </>
          }
        </Pressable>
      </View>
    </View>
  );
}

const cj = StyleSheet.create({
  card:        { backgroundColor: Colors.surface, borderRadius: borderRadius.xl, padding: 16, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  emptyCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: borderRadius.xl, padding: 16, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  emptyText:   { fontSize: 14, color: Colors.textMuted, flex: 1 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  customerName:{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  serviceName: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  etaBadge:    { backgroundColor: Colors.accentMuted, borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  etaText:     { fontSize: 12, fontWeight: '700', color: Colors.accent },
  addressRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 14 },
  addressText: { fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  btnRow:      { flexDirection: 'row', gap: 10 },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.accentMuted, borderRadius: borderRadius.md, paddingVertical: 11,
    overflow: 'hidden',
  },
  navBtnText:     { fontSize: 14, fontWeight: '700', color: Colors.accent },
  arrivedBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingVertical: 11, minHeight: 42,
    overflow: 'hidden',
  },
  arrivedBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});

// ── Web fallback ──────────────────────────────────────────────────────────────

function WebFallback() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, paddingTop: insets.top + 16 }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 12, left: 16, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', elevation: 4 }}
      >
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Ionicons name="navigate-outline" size={48} color={Colors.accent} />
      <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.textPrimary }}>GPS Tracking</Text>
      <Text style={{ fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
        Location tracking is only available on the mobile app.
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrackingScreen() {
  if (Platform.OS === 'web') return <WebFallback />;

  return <TrackingScreenNative />;
}

function TrackingScreenNative() {
  const { user }    = useAuth();
  const insets      = useSafeAreaInsets();

  const [shiftActive,  setShiftActive]  = useState(false);
  const [shiftStartMs, setShiftStartMs] = useState<number | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [actionBusy,   setActionBusy]   = useState(false);
  const [arrivedBusy,  setArrivedBusy]  = useState(false);
  const [currentJob,   setCurrentJob]   = useState<CurrentJob | null>(null);
  const [nextJob,      setNextJob]      = useState<NextJob | null>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(-1);
  const [batteryState, setBatteryState] = useState<Battery.BatteryState>(Battery.BatteryState.UNKNOWN);

  const cardAnim   = useRef(new Animated.Value(280)).current;
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const batteryRef = useRef<Battery.Subscription | null>(null);
  const locationRef= useRef<Location.LocationSubscription | null>(null);
  const mounted    = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
    pollRef.current    && clearInterval(pollRef.current);
    batteryRef.current?.remove();
    locationRef.current?.remove();
  }, []);

  // ── Initialise ─────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const running = await isLocationTaskRunning();
      if (mounted.current) setShiftActive(running);
      setLoading(false);
    })();
  }, []);

  // ── Battery ────────────────────────────────────────────────────────────────

  useEffect(() => {
    Battery.getBatteryLevelAsync().then(l => { if (mounted.current) setBatteryLevel(l); });
    Battery.getBatteryStateAsync().then(s => { if (mounted.current) setBatteryState(s); });
    batteryRef.current = Battery.addBatteryLevelListener(({ batteryLevel: l }) => {
      if (mounted.current) setBatteryLevel(l);
    });
    return () => { batteryRef.current?.remove(); };
  }, []);

  // ── Foreground location subscription ──────────────────────────────────────

  useEffect(() => {
    if (!shiftActive) {
      locationRef.current?.remove();
      locationRef.current = null;
      return;
    }
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 15 },
      loc => { if (mounted.current) setUserLocation(loc); },
    ).then(sub => { locationRef.current = sub; });

    return () => { locationRef.current?.remove(); locationRef.current = null; };
  }, [shiftActive]);

  // ── Slide bottom card ──────────────────────────────────────────────────────

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: loading ? 280 : 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [loading]);

  // ── Fetch current job ──────────────────────────────────────────────────────

  const fetchCurrentJob = useCallback(async () => {
    try {
      const { data } = await axios.get<{ current?: CurrentJob; next?: NextJob }>('/api/jobs/current');
      if (mounted.current) {
        setCurrentJob(data.current ?? null);
        setNextJob(data.next ?? null);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchCurrentJob();
    pollRef.current = setInterval(fetchCurrentJob, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCurrentJob]);

  // ── Start shift ────────────────────────────────────────────────────────────

  const handleStart = async () => {
    setActionBusy(true);
    try {
      // Request foreground permission
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permission Required', 'Foreground location access is needed to track your position.');
        return;
      }

      // Request background permission
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert('Background Location', 'Background location was not granted. Tracking only works while the app is open.');
      }

      // Start background task
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy:         Location.Accuracy.High,
        timeInterval:     15_000,
        distanceInterval: 20,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Wash Hub',
          notificationBody:  'Tracking your location for active shift',
          notificationColor: Colors.accent,
        },
      });

      // Notify server
      await axios.post('/api/staff/shift/start');

      if (mounted.current) {
        setShiftActive(true);
        setShiftStartMs(Date.now());
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not start shift. Please try again.');
    } finally {
      if (mounted.current) setActionBusy(false);
    }
  };

  // ── End shift ──────────────────────────────────────────────────────────────

  const handleEnd = () => {
    Alert.alert('End Shift', 'Stop location tracking and go offline?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Shift',
        style: 'destructive',
        onPress: async () => {
          setActionBusy(true);
          try {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK);
            await axios.post('/api/staff/shift/end');
            if (mounted.current) {
              setShiftActive(false);
              setShiftStartMs(null);
              setUserLocation(null);
            }
          } catch {
            if (mounted.current) {
              setShiftActive(false);
              setShiftStartMs(null);
            }
          } finally {
            if (mounted.current) setActionBusy(false);
          }
        },
      },
    ]);
  };

  // ── Mark arrived ───────────────────────────────────────────────────────────

  const handleMarkArrived = async () => {
    if (!currentJob) return;
    setArrivedBusy(true);
    try {
      await axios.patch(`/api/jobs/${currentJob._id}/status`, { status: 'arrived' });
      await fetchCurrentJob();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Could not update status.');
    } finally {
      if (mounted.current) setArrivedBusy(false);
    }
  };

  const isLowBattery = batteryLevel > 0 && batteryLevel < LOW_BATTERY;
  const isCharging   = batteryState === Battery.BatteryState.CHARGING
                    || batteryState === Battery.BatteryState.FULL;

  // Route coordinates for Polyline
  const routeCoords =
    userLocation && currentJob?.lat && currentJob?.lng
      ? [
          { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
          { latitude: currentJob.lat,               longitude: currentJob.lng               },
        ]
      : [];

  // Map initial region
  const mapRegion = userLocation
    ? {
        latitude:       userLocation.coords.latitude,
        longitude:      userLocation.coords.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }
    : undefined;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // Lazy-require react-native-maps to avoid crash if not installed
  let MapView: any, Polyline: any;
  try {
    const maps = require('react-native-maps');
    MapView   = maps.default;
    Polyline  = maps.Polyline;
  } catch {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Ionicons name="map-outline" size={48} color={Colors.textMuted} />
        <Text style={{ fontSize: 16, color: Colors.textMuted, textAlign: 'center' }}>Map unavailable (react-native-maps not installed)</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>

      {/* ── Full screen map ── */}
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={mapRegion}
        showsUserLocation
        followsUserLocation={shiftActive}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Route line to current job */}
        {routeCoords.length === 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={Colors.accent}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* ── Floating back button (top left) ── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 100,
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 20,
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        }}
      >
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* ── Top floating panel (shift banner + battery warning) ── */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 68,   // clear of back button
          right: 16,
          gap: 8,
          zIndex: 50,
        }}
        pointerEvents="box-none"
      >
        <ShiftBanner
          shiftActive={shiftActive}
          startMs={shiftStartMs}
          actionBusy={actionBusy}
          onStart={handleStart}
          onEnd={handleEnd}
        />
        {isLowBattery && !isCharging && <BatteryWarning />}
      </View>

      {/* ── Bottom floating panel ── */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 16,
          left: 16,
          right: 16,
          gap: 10,
          transform: [{ translateY: cardAnim }],
        }}
        pointerEvents="box-none"
      >
        {/* Next job preview */}
        {nextJob && <NextJobPreview job={nextJob} />}

        {/* Current job card */}
        <CurrentJobCard
          job={currentJob}
          onMarkArrived={handleMarkArrived}
          arrivedBusy={arrivedBusy}
        />
      </Animated.View>

    </View>
  );
}
