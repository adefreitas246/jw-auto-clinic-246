// app/(customer)/track/[id].tsx — Live Job Tracking
// Polls GET /api/jobs/:id every 15 s in the foreground.
// No tab bar — immersive full-screen with floating back button.
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';

import {
  JOB_STEPS, JOB_STATUS_LABELS, JobStatus, JobTracking,
} from '@/types/job';
import { useSpeechStatus } from '@/hooks/useSpeechStatus';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Extended type (optional fields the API may add later) ─────────────────────

interface JobTrackingExtended extends JobTracking {
  technicianRating?: number;
  stepTimestamps?:   Partial<Record<JobStatus, string>>;
  vehicleMake?:      string;
  vehicleModel?:     string;
  vehiclePlate?:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const isExpoGo           = Constants.appOwnership === 'expo';
const FOREGROUND_POLL_MS = 15_000;

// Lazy-load expo-notifications so it never runs in Expo Go (crashes on SDK 53+)
function getNotifications() {
  if (isExpoGo) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications') as typeof import('expo-notifications');
}

function getJobTrackingTask() {
  return require('@/tasks/jobTrackingTask') as typeof import('@/tasks/jobTrackingTask');
}

const SPEECH_PHRASES: Record<string, string> = {
  assigned:      'Your booking is confirmed. A technician will be with you soon.',
  in_progress:   'Your vehicle is now being washed.',
  completed:     'The wash is complete. Quality check in progress.',
  quality_check: 'Quality check in progress. Almost done.',
  finished:      'Your vehicle is ready for pickup!',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ── OSRM route + ETA ──────────────────────────────────────────────────────────

async function fetchRoute(
  fromLat: number, fromLng: number,
  toLat:   number, toLng:   number,
): Promise<{ etaMin: number | null; coords: { latitude: number; longitude: number }[] }> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const { data } = await axios.get(url);
    const route    = data?.routes?.[0];
    const secs: number | undefined = route?.duration;
    const coords: { latitude: number; longitude: number }[] =
      route?.geometry?.coordinates?.map(([lng, lat]: [number, number]) => ({
        latitude: lat, longitude: lng,
      })) ?? [];
    return { etaMin: secs != null ? Math.ceil(secs / 60) : null, coords };
  } catch {
    return { etaMin: null, coords: [] };
  }
}

// ── StepDot ───────────────────────────────────────────────────────────────────

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [active]);

  const bg  = done ? Colors.success : active ? Colors.accent : Colors.surfaceAlt;
  const bdr = done ? Colors.success : active ? Colors.accent : Colors.border;

  return (
    <Animated.View
      style={[
        st.dot,
        { backgroundColor: bg, borderColor: bdr, opacity: active ? pulse : 1 },
      ]}
    >
      {done ? (
        <Ionicons name="checkmark" size={14} color={Colors.white} />
      ) : active ? (
        <View style={st.dotInner} />
      ) : null}
    </Animated.View>
  );
}

// ── JobStepper ────────────────────────────────────────────────────────────────

function JobStepper({
  status,
  timestamps,
}: {
  status:      JobStatus;
  timestamps?: Partial<Record<JobStatus, string>>;
}) {
  const currentIdx = JOB_STEPS.findIndex(s => s.status === status);

  return (
    <View style={st.stepperWrap}>
      {JOB_STEPS.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        const ts     = timestamps?.[step.status];

        return (
          <View key={step.status}>
            <View style={st.stepRow}>
              <View style={st.stepLeft}>
                <StepDot active={active} done={done} />
              </View>

              <View style={st.stepContent}>
                <Text
                  style={[
                    st.stepLabel,
                    done   && st.stepLabelDone,
                    active && st.stepLabelActive,
                  ]}
                >
                  {step.label}
                </Text>
                {active && <Text style={st.stepSub}>In progress…</Text>}
                {done && ts ? <Text style={st.stepTimestamp}>{fmtTime(ts)}</Text> : null}
              </View>

              {(done || active) && (
                <Ionicons
                  name={step.icon as any}
                  size={18}
                  color={done ? Colors.success : Colors.accent}
                />
              )}
            </View>

            {i < JOB_STEPS.length - 1 && (
              <View style={st.connectorWrap}>
                <View style={[st.connector, done && st.connectorDone]} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── RatingStars ───────────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={12}
          color={Colors.warning}
        />
      ))}
    </View>
  );
}

// ── NotificationStatus ────────────────────────────────────────────────────────

function NotificationStatus({
  enabled,
  onEnable,
}: {
  enabled:  boolean | null;
  onEnable: () => void;
}) {
  if (enabled === null) return null;
  return (
    <View style={st.notifCard}>
      <Ionicons
        name={enabled ? 'notifications' : 'notifications-off-outline'}
        size={18}
        color={enabled ? Colors.success : Colors.textMuted}
      />
      <Text style={st.notifText} numberOfLines={2}>
        {enabled
          ? "You'll be notified at each step"
          : 'Enable notifications to get updates'}
      </Text>
      {!enabled && (
        <Pressable
          style={st.notifBtn}
          onPress={onEnable}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Text style={st.notifBtnText}>Enable</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrackJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [job,          setJob]          = useState<JobTrackingExtended | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [etaMin,       setEtaMin]       = useState<number | null>(null);
  const [routeCoords,  setRouteCoords]  = useState<{ latitude: number; longitude: number }[]>([]);
  const [banner,       setBanner]       = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState<boolean | null>(null);

  const prevStatusRef  = useRef<JobStatus | null>(null);
  const bannerAnim     = useRef(new Animated.Value(0)).current;
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskRegistered = useRef(false);

  const { speak, stop, voiceEnabled, setVoiceEnabled } = useSpeechStatus();

  // ── Notification permission ────────────────────────────────────────────────
  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return; // Expo Go — skip
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifEnabled(status === 'granted');
    });
  }, []);

  const requestNotifPermission = useCallback(async () => {
    const Notifications = getNotifications();
    if (!Notifications) return;
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifEnabled(status === 'granted');
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => { return () => { stop(); }; }, [stop]);

  // ── Banner animation ───────────────────────────────────────────────────────
  const showBanner = useCallback((msg: string) => {
    setBanner(msg);
    bannerAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(bannerAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setBanner(null));
  }, [bannerAnim]);

  // ── Fetch job ──────────────────────────────────────────────────────────────
  const fetchJob = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<JobTrackingExtended>(`/api/jobs/${id}`);

      if (prevStatusRef.current !== data.jobStatus) {
        if (prevStatusRef.current !== null) {
          showBanner(JOB_STATUS_LABELS[data.jobStatus]);
        }
        const phrase = SPEECH_PHRASES[data.jobStatus];
        if (phrase) speak(phrase);
      }
      prevStatusRef.current = data.jobStatus;
      setJob(data);

      // Route + ETA (mobile jobs only)
      if (
        data.locationType === 'mobile' &&
        data.technicianLat != null && data.technicianLng != null &&
        data.mobileLat     != null && data.mobileLng     != null
      ) {
        const result = await fetchRoute(
          data.technicianLat, data.technicianLng,
          data.mobileLat,     data.mobileLng,
        );
        setEtaMin(result.etaMin);
        setRouteCoords(result.coords);
      } else {
        setEtaMin(null);
        setRouteCoords([]);
      }

      if (data.jobStatus === 'finished') {
        if (pollRef.current) clearInterval(pollRef.current);
        if (!isExpoGo) await getJobTrackingTask().unregisterJobTracking();
        taskRegistered.current = false;
      }
    } catch {
      // Keep stale data visible; user can pull-to-refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, showBanner, speak]);

  // ── Poll every 15 s ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchJob();
    pollRef.current = setInterval(() => fetchJob(true), FOREGROUND_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchJob]);

  // ── Background task ────────────────────────────────────────────────────────
  useEffect(() => {
    if (job && !taskRegistered.current && !isExpoGo) {
      taskRegistered.current = true;
      getJobTrackingTask().registerJobTracking(job._id, job.jobStatus);
    }
  }, [job?._id, job?.jobStatus]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJob(true);
  }, [fetchJob]);

  const bannerTranslateY = bannerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-60, 0],
  });

  // Floating buttons positioned below the system status bar
  const floatingTop = insets.top + 12;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !job) {
    return (
      <View style={st.fullScreen}>
        <Pressable
          style={[st.floatingBackBtn, { top: floatingTop }]}
          onPress={() => router.back()}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={st.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (!job) {
    return (
      <View style={st.fullScreen}>
        <Pressable
          style={[st.floatingBackBtn, { top: floatingTop }]}
          onPress={() => router.back()}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={st.centered}>
          <View style={st.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          </View>
          <Text style={st.errText}>Could not load job details.</Text>
          <Pressable
            style={st.retryBtn}
            onPress={() => fetchJob()}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={st.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isMobile     = job.locationType === 'mobile';
  const hasTechLoc   = isMobile && job.technicianLat != null && job.technicianLng != null;
  const hasMap       = isMobile && job.mobileLat != null && job.mobileLng != null && Platform.OS !== 'web';
  const isDone       = job.jobStatus === 'finished';
  const isActive     = !isDone && !!job.assignedStaffId;
  const techInitials = job.technicianName ? getInitials(job.technicianName) : '?';

  return (
    <View style={st.fullScreen}>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { paddingTop: floatingTop + 56 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >

        {/* ── Job status stepper ── */}
        <View style={st.card}>
          <Text style={st.cardSectionLabel}>Wash Progress</Text>
          <JobStepper status={job.jobStatus} timestamps={job.stepTimestamps} />
        </View>

        {/* ── Vehicle info card ── */}
        <View style={st.card}>
          <Text style={st.cardSectionLabel}>Vehicle & Service</Text>

          <View style={st.infoRow}>
            <View style={st.infoIconWrap}>
              <Ionicons name="car-sport-outline" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.infoValue}>
                {(job.vehicleMake || job.vehicleModel)
                  ? [job.vehicleMake, job.vehicleModel].filter(Boolean).join(' ')
                  : (job.vehicleLabel || 'Vehicle')}
              </Text>
              {job.vehiclePlate ? (
                <Text style={st.infoSub}>{job.vehiclePlate}</Text>
              ) : null}
            </View>
          </View>

          <View style={[st.infoRow, { marginTop: 14 }]}>
            <View style={st.infoIconWrap}>
              <Ionicons name="layers-outline" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.infoValue}>{job.serviceLabel}</Text>
              <Text style={st.infoSub}>
                {job.appointmentDate} · {job.appointmentTime}
              </Text>
            </View>
          </View>

          <View style={[st.infoRow, { marginTop: 14 }]}>
            <View style={st.infoIconWrap}>
              <Ionicons
                name={isMobile ? 'navigate-outline' : 'business-outline'}
                size={18}
                color={Colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.infoValue}>
                {isMobile
                  ? (job.mobileAddress || 'Mobile service')
                  : (job.bayLabel     || 'Bay location')}
              </Text>
              {!isMobile && job.bayAddress ? (
                <Text style={st.infoSub}>{job.bayAddress}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Technician card (when job is active & technician assigned) ── */}
        {isActive && job.technicianName ? (
          <View style={st.card}>
            <Text style={st.cardSectionLabel}>Your Technician</Text>
            <View style={st.techRow}>
              <View style={st.techAvatar}>
                <Text style={st.techInitials}>{techInitials}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={st.techName}>{job.technicianName}</Text>
                {job.technicianRating != null ? (
                  <RatingStars rating={job.technicianRating} />
                ) : null}
              </View>

              {etaMin !== null && hasTechLoc && !isDone ? (
                <View style={st.etaChip}>
                  <Ionicons name="time-outline" size={13} color={Colors.accent} />
                  <Text style={st.etaText}>
                    ETA: <Text style={st.etaBold}>{etaMin} min</Text>
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Map (mobile jobs only, native platforms) ── */}
        {hasMap && job.mobileLat != null && job.mobileLng != null ? (
          <View style={st.mapCard}>
            <MapView
              style={st.map}
              initialRegion={{
                latitude:       job.mobileLat,
                longitude:      job.mobileLng,
                latitudeDelta:  0.025,
                longitudeDelta: 0.025,
              }}
              showsUserLocation={false}
              toolbarEnabled={false}
            >
              {/* Customer location marker */}
              <Marker
                coordinate={{ latitude: job.mobileLat, longitude: job.mobileLng }}
                title="Your Location"
                pinColor={Colors.accent}
              />

              {/* Technician marker */}
              {hasTechLoc && (
                <Marker
                  coordinate={{
                    latitude:  job.technicianLat!,
                    longitude: job.technicianLng!,
                  }}
                  title={job.technicianName || 'Technician'}
                >
                  <View style={st.techMarker}>
                    <Ionicons name="car" size={16} color={Colors.white} />
                  </View>
                </Marker>
              )}

              {/* Route line between technician and customer */}
              {routeCoords.length >= 2 && (
                <Polyline
                  coordinates={routeCoords}
                  strokeColor={Colors.accent}
                  strokeWidth={3}
                />
              )}
            </MapView>

            <View style={st.mapCaption}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
              <Text style={st.mapCaptionText}>
                {hasTechLoc
                  ? 'Technician en route to your location'
                  : 'Your service location'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Bay location card (fixed wash, no map) ── */}
        {!isMobile && job.bayLabel ? (
          <View style={st.locationCard}>
            <View style={st.locationIconWrap}>
              <Ionicons name="location" size={16} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.locationLabel}>{job.bayLabel}</Text>
              {job.bayAddress ? (
                <Text style={st.locationAddr}>{job.bayAddress}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Done banner ── */}
        {isDone && (
          <View style={st.doneBanner}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={st.doneTitle}>Your vehicle is ready!</Text>
              <Text style={st.doneSub}>Head over to pick it up.</Text>
            </View>
          </View>
        )}

        {/* ── Push notification status ── */}
        <NotificationStatus
          enabled={notifEnabled}
          onEnable={requestNotifPermission}
        />

        {/* ── CTA ── */}
        {isDone ? (
          <Pressable
            style={st.doneBtn}
            onPress={() => router.replace('/(customer)/home')}
            android_ripple={{ color: Colors.primaryDark + '40', borderless: false }}
          >
            <Ionicons name="home" size={18} color={Colors.white} />
            <Text style={st.doneBtnText}>Back to Home</Text>
          </Pressable>
        ) : (
          <Pressable
            style={st.contactBtn}
            onPress={() => {}}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Ionicons name="call-outline" size={18} color={Colors.accent} />
            <Text style={st.contactBtnText}>Contact Wash Bay</Text>
          </Pressable>
        )}

      </ScrollView>

      {/* ── Floating back button (top left) ── */}
      <Pressable
        style={[st.floatingBackBtn, { top: floatingTop }]}
        onPress={() => router.back()}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </Pressable>

      {/* ── Floating voice toggle (top right) ── */}
      <Pressable
        style={[
          st.floatingVoiceBtn,
          { top: floatingTop },
          voiceEnabled && st.floatingVoiceBtnOn,
        ]}
        onPress={() => setVoiceEnabled(!voiceEnabled)}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
        hitSlop={8}
      >
        <Ionicons
          name={voiceEnabled ? 'volume-high' : 'volume-mute-outline'}
          size={18}
          color={voiceEnabled ? Colors.accent : Colors.textMuted}
        />
      </Pressable>

      {/* ── Status-change banner ── */}
      {banner && (
        <Animated.View
          style={[
            st.banner,
            {
              top:       floatingTop + 52,
              opacity:   bannerAnim,
              transform: [{ translateY: bannerTranslateY }],
            },
          ]}
        >
          <Ionicons name="information-circle" size={16} color={Colors.white} />
          <Text style={st.bannerText}>{banner}</Text>
        </Animated.View>
      )}

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FLOATING_SHADOW = IS_IOS
  ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }
  : { elevation: 8 };

const st = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: Colors.background },
  scroll:     { flex: 1 },
  content:    { paddingHorizontal: SCREEN_PADDING, paddingBottom: 20 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Floating buttons
  floatingBackBtn: {
    position: 'absolute',
    left: SCREEN_PADDING,
    zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    ...FLOATING_SHADOW,
  },
  floatingVoiceBtn: {
    position: 'absolute',
    right: SCREEN_PADDING,
    zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    ...FLOATING_SHADOW,
  },
  floatingVoiceBtnOn: { backgroundColor: Colors.accentMuted },

  // Error
  errorIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.errorBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  errText:  { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: 28, paddingVertical: 12,
    overflow: 'hidden',
  },
  retryText: { color: Colors.white, fontWeight: '700' },

  // Status-change banner
  banner: {
    position: 'absolute',
    left: SCREEN_PADDING, right: SCREEN_PADDING,
    zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: borderRadius.lg,
    ...cardShadow,
  },
  bannerText: { color: Colors.white, fontWeight: '700', fontSize: 13, flex: 1 },

  // Cards
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 14,
    ...cardShadow,
  },
  cardSectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 18,
  },

  // Stepper
  stepperWrap:     { paddingLeft: 2 },
  stepRow:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepLeft:        { alignItems: 'center', width: 32 },
  dot:             { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  dotInner:        { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white },
  stepContent:     { flex: 1, paddingVertical: 4 },
  stepLabel:       { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  stepLabelDone:   { color: Colors.success },
  stepLabelActive: { color: Colors.textPrimary, fontWeight: '700' },
  stepSub:         { fontSize: 12, color: Colors.accent, marginTop: 2 },
  stepTimestamp:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  connectorWrap:   { paddingLeft: 15 },
  connector:       { width: 2, height: 22, backgroundColor: Colors.border, marginVertical: 2 },
  connectorDone:   { backgroundColor: Colors.success },

  // Vehicle / service info rows
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  infoSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Technician card
  techRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  techAvatar:   {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  techInitials: { fontSize: 16, fontWeight: '800', color: Colors.accent },
  techName:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },

  // ETA chip (inside technician card)
  etaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10, paddingVertical: 6,
    flexShrink: 0,
  },
  etaText: { fontSize: 12, color: Colors.textSecondary },
  etaBold: { fontWeight: '700', color: Colors.accent },

  // Map
  mapCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: 14,
    ...cardShadow,
  },
  map: { height: 240 },
  mapCaption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  mapCaptionText: { fontSize: 12, color: Colors.textMuted },
  techMarker: {
    backgroundColor: Colors.accent,
    borderRadius: 20,
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },

  // Bay location card
  locationCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 14,
    ...cardShadow,
  },
  locationIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  locationLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  locationAddr:  { fontSize: 13, color: Colors.textMuted, marginTop: 3 },

  // Done banner
  doneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.successBg,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 14,
  },
  doneTitle: { fontSize: 15, fontWeight: '800', color: Colors.success },
  doneSub:   { fontSize: 13, color: Colors.success, marginTop: 2, opacity: 0.8 },

  // Notification status
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  notifText:    { flex: 1, fontSize: 13, color: Colors.textSecondary },
  notifBtn:     {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12, paddingVertical: 7,
    overflow: 'hidden',
  },
  notifBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  // Action buttons
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    marginBottom: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  doneBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.lg,
    paddingVertical: 15,
    marginBottom: 8,
    borderWidth: 1.5, borderColor: Colors.accentLight,
    overflow: 'hidden',
  },
  contactBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
});
