// app/(customer)/track/[id].tsx — Live Job Tracking
// Polls GET /api/jobs/:id every 30 s in the foreground;
// expo-background-fetch handles polling when the app is backgrounded.
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import {
  JOB_STEPS, JOB_STATUS_LABELS, JobStatus, JobTracking,
} from '@/types/job';
import { useSpeechStatus } from '@/hooks/useSpeechStatus';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

// jobTrackingTask imports expo-notifications (for background status pushes) and
// expo-background-fetch. Both crash in Expo Go at module-load time.
// We require() the task file lazily inside !isExpoGo guards so the module is
// never evaluated in Expo Go.
function getJobTrackingTask() {
  return require('@/tasks/jobTrackingTask') as typeof import('@/tasks/jobTrackingTask');
}

// Human-readable speech phrases per status
const SPEECH_PHRASES: Record<string, string> = {
  assigned:      'Your booking is confirmed. A technician will be with you soon.',
  in_progress:   'Your vehicle is now being washed.',
  completed:     'The wash is complete. Quality check in progress.',
  quality_check: 'Quality check in progress. Almost done.',
  finished:      'Your vehicle is ready for pickup!',
};

const isExpoGo = Constants.appOwnership === 'expo';
const FOREGROUND_POLL_MS = 30_000;

// ─── Animated step dot ────────────────────────────────────────────────────────
function StepDot({ active, done }: { active: boolean; done: boolean }) {
  const scale = useRef(new Animated.Value(done || active ? 1 : 0.75)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: done || active ? 1 : 0.75,
      useNativeDriver: true,
    }).start();
  }, [active, done]);

  const bg = done || active ? Colors.accent : Colors.border;

  return (
    <Animated.View style={[st.dot, { backgroundColor: bg, transform: [{ scale }] }]}>
      {done
        ? <Ionicons name="checkmark" size={13} color={Colors.white} />
        : active
        ? <View style={st.dotPulse} />
        : null
      }
    </Animated.View>
  );
}

// ─── Vertical stepper ────────────────────────────────────────────────────────
function JobStepper({ status }: { status: JobStatus }) {
  const currentIdx = JOB_STEPS.findIndex(s => s.status === status);

  return (
    <View>
      {JOB_STEPS.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <View key={step.status}>
            <View style={st.stepRow}>
              <StepDot active={active} done={done} />
              <View style={{ flex: 1 }}>
                <Text style={[st.stepLabel, (active || done) && st.stepLabelOn]}>
                  {step.label}
                </Text>
                {active && (
                  <Text style={st.stepSub}>In progress…</Text>
                )}
              </View>
              {(done || active) && (
                <Ionicons
                  name={step.icon as any}
                  size={18}
                  color={active ? Colors.accent : Colors.border}
                />
              )}
            </View>

            {i < JOB_STEPS.length - 1 && (
              <View style={[st.connector, done && st.connectorDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── OSRM ETA ─────────────────────────────────────────────────────────────────
async function fetchEtaMinutes(
  fromLat: number, fromLng: number,
  toLat:   number, toLng:   number
): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const { data } = await axios.get(url);
    const secs: number | undefined = data?.routes?.[0]?.duration;
    return secs != null ? Math.ceil(secs / 60) : null;
  } catch {
    return null;
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TrackJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [job,        setJob]        = useState<JobTracking | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [etaMin,     setEtaMin]     = useState<number | null>(null);
  const [banner,     setBanner]     = useState<string | null>(null);

  const prevStatusRef  = useRef<JobStatus | null>(null);
  const bannerAnim     = useRef(new Animated.Value(0)).current;
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskRegistered = useRef(false);

  const { speak, stop, voiceEnabled, setVoiceEnabled } = useSpeechStatus();

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
      const { data } = await axios.get<JobTracking>(`/api/jobs/${id}`);

      if (prevStatusRef.current !== data.jobStatus) {
        const isFirstLoad = prevStatusRef.current === null;
        if (!isFirstLoad) {
          showBanner(JOB_STATUS_LABELS[data.jobStatus]);
        }
        const phrase = SPEECH_PHRASES[data.jobStatus];
        if (phrase) speak(phrase);
      }
      prevStatusRef.current = data.jobStatus;
      setJob(data);

      if (
        data.locationType === 'mobile' &&
        data.technicianLat != null && data.technicianLng != null &&
        data.mobileLat     != null && data.mobileLng     != null
      ) {
        const eta = await fetchEtaMinutes(
          data.technicianLat, data.technicianLng,
          data.mobileLat,     data.mobileLng
        );
        setEtaMin(eta);
      } else {
        setEtaMin(null);
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
  }, [id, showBanner]);

  // ── Mount / poll ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchJob();
    pollRef.current = setInterval(() => fetchJob(true), FOREGROUND_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchJob]);

  useEffect(() => {
    if (job && !taskRegistered.current && !isExpoGo) {
      taskRegistered.current = true;
      getJobTrackingTask().registerJobTracking(job._id, job.jobStatus);
    }
  }, [job?._id, job?.jobStatus]);

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJob(true);
  }, [fetchJob]);

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading && !job) {
    return (
      <View style={st.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={st.centered}>
        <View style={st.errorIconWrap}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
        </View>
        <Text style={st.errText}>Could not load job details.</Text>
        <Pressable
          style={st.retryBtn}
          onPress={() => fetchJob()}
          android_ripple={{ color: Colors.primaryDark }}
        >
          <Text style={st.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const isMobile   = job.locationType === 'mobile';
  const hasTechLoc = isMobile && job.technicianLat != null && job.technicianLng != null;
  const isDone     = job.jobStatus === 'finished';

  const bannerTranslate = bannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-56, 0],
  });

  return (
    <SafeAreaView style={st.safe} edges={['top']}>

      {/* ── Status-change banner ── */}
      {banner && (
        <Animated.View
          style={[
            st.banner,
            { opacity: bannerAnim, transform: [{ translateY: bannerTranslate }] },
          ]}
        >
          <Ionicons name="information-circle" size={16} color={Colors.white} />
          <Text style={st.bannerText}>{banner}</Text>
        </Animated.View>
      )}

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* ── Header ── */}
        <View style={st.header}>
          <Pressable
            style={st.headerIconBtn}
            onPress={() => router.back()}
            hitSlop={8}
            android_ripple={{ color: Colors.border, borderless: true, radius: 20 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={st.headerTitle}>Track Job</Text>
          <Pressable
            style={[st.voiceBtn, voiceEnabled && st.voiceBtnOn]}
            onPress={() => setVoiceEnabled(!voiceEnabled)}
            hitSlop={8}
            android_ripple={{ color: Colors.border, borderless: true, radius: 20 }}
          >
            <Ionicons
              name={voiceEnabled ? 'volume-high' : 'volume-mute-outline'}
              size={18}
              color={voiceEnabled ? Colors.accent : Colors.textMuted}
            />
          </Pressable>
        </View>

        {/* ── Service summary card ── */}
        <View style={st.card}>
          <Text style={st.serviceName}>{job.serviceLabel}</Text>
          <View style={st.serviceMetaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={st.serviceDate}>
              {job.appointmentDate} · {job.appointmentTime}
            </Text>
          </View>
          {job.technicianName ? (
            <View style={st.techRow}>
              <View style={st.techAvatar}>
                <Ionicons name="person" size={14} color={Colors.accent} />
              </View>
              <Text style={st.techName}>{job.technicianName}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Animated stepper ── */}
        <View style={[st.card, { paddingVertical: 20 }]}>
          <Text style={st.cardSectionLabel}>Wash Progress</Text>
          <JobStepper status={job.jobStatus} />
        </View>

        {/* ── ETA chip ── */}
        {isMobile && hasTechLoc && etaMin !== null && !isDone && (
          <View style={st.etaChip}>
            <View style={st.etaIconWrap}>
              <Ionicons name="time-outline" size={14} color={Colors.accent} />
            </View>
            <Text style={st.etaText}>
              Technician ETA:{' '}
              <Text style={st.etaBold}>{etaMin} min</Text>
            </Text>
          </View>
        )}

        {/* ── Map (mobile jobs only, native platforms) ── */}
        {isMobile && job.mobileLat != null && job.mobileLng != null && Platform.OS !== 'web' && (
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
              <Marker
                coordinate={{ latitude: job.mobileLat, longitude: job.mobileLng }}
                title="Your Location"
                pinColor={Colors.accent}
              />

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
            </MapView>
            <View style={st.mapCaption}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
              <Text style={st.mapCaptionText}>
                {hasTechLoc
                  ? 'Purple = technician · Blue = your location'
                  : 'Your service location'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Bay location card ── */}
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

        {/* ── Done CTA ── */}
        {isDone && (
          <View style={st.doneBanner}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={st.doneTitle}>Your vehicle is ready!</Text>
              <Text style={st.doneSub}>Head over to pick it up.</Text>
            </View>
          </View>
        )}

        {isDone && (
          <Pressable
            style={st.doneBtn}
            onPress={() => router.replace('/(customer)/home')}
            android_ripple={{ color: Colors.primaryDark }}
          >
            <Ionicons name="home" size={18} color={Colors.white} />
            <Text style={st.doneBtnText}>Back to Home</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { paddingBottom: 48 },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

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
  retryText:{ color: Colors.white, fontWeight: '700' },

  // Banner
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: borderRadius.md,
    margin: 12,
    ...cardShadow,
  },
  bannerText: { color: Colors.white, fontWeight: '700', fontSize: 14, flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  voiceBtn:    {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  voiceBtnOn: { backgroundColor: Colors.accentMuted },

  // Shared card
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginTop: 16,
    ...cardShadow,
  },
  cardSectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 16,
  },

  // Service summary
  serviceName:   { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  serviceMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  serviceDate:   { fontSize: 13, color: Colors.textMuted },
  techRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  techAvatar:    {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  techName: { fontSize: 13, color: Colors.accent, fontWeight: '600' },

  // Stepper
  stepRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dot:         { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotPulse:    { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white },
  stepLabel:   { fontSize: 14, fontWeight: '600', color: Colors.border },
  stepLabelOn: { color: Colors.textPrimary },
  stepSub:     { fontSize: 12, color: Colors.accent, marginTop: 2 },
  connector:     { width: 2, height: 20, backgroundColor: Colors.border, marginLeft: 13, marginVertical: 2 },
  connectorDone: { backgroundColor: Colors.accent },

  // ETA chip
  etaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14, paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  etaIconWrap:{ width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  etaText:    { fontSize: 13, color: Colors.textSecondary },
  etaBold:    { fontWeight: '700', color: Colors.accent },

  // Map
  mapCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
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

  // Location card
  locationCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.surface,
    marginHorizontal: 20, marginTop: 16,
    borderRadius: borderRadius.lg,
    padding: 16,
    ...cardShadow,
  },
  locationIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  locationLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  locationAddr:  { fontSize: 13, color: Colors.textMuted, marginTop: 3 },

  // Done
  doneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.successBg,
    marginHorizontal: 20, marginTop: 16,
    borderRadius: borderRadius.lg,
    padding: 16,
  },
  doneTitle: { fontSize: 15, fontWeight: '800', color: Colors.success },
  doneSub:   { fontSize: 13, color: Colors.success, marginTop: 2, opacity: 0.8 },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    marginHorizontal: 20, marginTop: 12,
    overflow: 'hidden',
    ...cardShadow,
  },
  doneBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
