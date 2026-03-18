// app/(tabs)/jobs/[id].tsx — Staff Job Detail
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem  from 'expo-file-system';
import * as Haptics     from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'quality_check'
  | 'finished';

interface JobPhoto {
  _id:   string;
  url?:  string;
  data?: string;
  label: 'before' | 'after';
}

interface Job {
  _id:             string;
  customerName?:   string;
  vehicleMake?:    string;
  vehicleModel?:   string;
  vehiclePlate?:   string;
  vehicleLabel?:   string;
  serviceName?:    string;
  serviceLabel?:   string;
  duration?:       number;
  appointmentDate: string;
  appointmentTime: string;
  locationType?:   'mobile' | 'bay';
  bayLabel?:       string;
  mobileAddress?:  string;
  status?:         JobStatus;
  jobStatus?:      JobStatus;
  staffNotes?:     string;
  photos?:         JobPhoto[];
}

interface LocalPhoto {
  id:       string;
  localUri: string;
  label:    'before' | 'after';
  pct:      number;
  done:     boolean;
  error:    boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS: Array<{ status: JobStatus; label: string }> = [
  { status: 'assigned',      label: 'Assigned'      },
  { status: 'in_progress',   label: 'In Progress'   },
  { status: 'completed',     label: 'Completed'     },
  { status: 'quality_check', label: 'Quality Check' },
  { status: 'finished',      label: 'Finished'      },
];

const NEXT_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  assigned:      'in_progress',
  in_progress:   'completed',
  completed:     'quality_check',
  quality_check: 'finished',
};

const ADVANCE_LABELS: Partial<Record<JobStatus, string>> = {
  assigned:      'Mark as In Progress',
  in_progress:   'Mark as Completed',
  completed:     'Mark as Quality Check',
  quality_check: 'Mark as Finished',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveStatus(job: Job): JobStatus {
  return (job.status ?? job.jobStatus ?? 'assigned') as JobStatus;
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

const CACHE_DIR = (FileSystem.cacheDirectory ?? '') + 'job-photos/';

async function copyToCache(uri: string, id: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  const dest = CACHE_DIR + id + '.jpg';
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

// ── Step circle ───────────────────────────────────────────────────────────────

function StepCircle({ done, active, number }: { done: boolean; active: boolean; number: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [active]);

  if (done) {
    return (
      <View style={[st.circle, { backgroundColor: Colors.success }]}>
        <Ionicons name="checkmark" size={16} color={Colors.white} />
      </View>
    );
  }

  if (active) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[st.circlePulse, { transform: [{ scale: pulse }] }]} />
        <View style={[st.circle, { backgroundColor: Colors.accent, position: 'absolute' }]}>
          <Text style={st.circleNum}>{number}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[st.circle, { backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border }]}>
      <Text style={[st.circleNum, { color: Colors.textMuted }]}>{number}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  circle:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  circlePulse: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent + '28', position: 'absolute' },
  circleNum:   { fontSize: 13, fontWeight: '800', color: Colors.white },
});

// ── Photo thumbnail ───────────────────────────────────────────────────────────

function PhotoThumb({ item, onRemove }: { item: LocalPhoto; onRemove: () => void }) {
  return (
    <View style={ph.thumb}>
      <Image source={{ uri: item.localUri }} style={{ flex: 1 }} />

      {!item.done && !item.error && (
        <View style={ph.progressOverlay}>
          <View style={[ph.progressBar, { width: `${item.pct}%` as any }]} />
          <Text style={ph.progressText}>{item.pct}%</Text>
        </View>
      )}

      {item.done && (
        <View style={ph.badge}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
        </View>
      )}

      {item.error && (
        <View style={ph.badge}>
          <Ionicons name="alert-circle" size={18} color={Colors.error} />
        </View>
      )}

      <Pressable style={ph.removeBtn} onPress={onRemove} hitSlop={6}>
        <Ionicons name="close-circle" size={20} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const ph = StyleSheet.create({
  thumb:           { height: 110, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: 8, backgroundColor: Colors.surfaceAlt },
  progressOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  progressBar:     { position: 'absolute', top: 0, left: 0, height: 3, backgroundColor: Colors.accent },
  progressText:    { color: Colors.white, fontSize: 12, fontWeight: '700' },
  badge:           { position: 'absolute', bottom: 4, right: 4 },
  removeBtn:       { position: 'absolute', top: 4, right: 4 },
});

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[tk.toast, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
      <Text style={tk.toastText}>Customer notified ✓</Text>
    </Animated.View>
  );
}

const tk = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.success,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [job,        setJob]        = useState<Job | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [advancing,  setAdvancing]  = useState(false);
  const [photos,     setPhotos]     = useState<LocalPhoto[]>([]);
  const [notes,      setNotes]      = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toast,      setToast]      = useState(false);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchJob = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<Job>(`/api/jobs/${id}`);
      setJob(data);
      if (!silent) {
        setNotes(data.staffNotes ?? '');
        if (data.photos?.length) {
          setPhotos(data.photos.map(p => ({
            id:       p._id,
            localUri: p.url ?? p.data ?? '',
            label:    p.label,
            pct:      100,
            done:     true,
            error:    false,
          })));
        }
      }
    } catch {
      if (!silent) Alert.alert('Error', 'Could not load job details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
    pollRef.current = setInterval(() => fetchJob(true), 30_000);
    return () => {
      if (pollRef.current)  clearInterval(pollRef.current);
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, [fetchJob]);

  // ── Advance status ─────────────────────────────────────────────────────────

  const advanceStatus = async () => {
    if (!job) return;
    const currentStatus = resolveStatus(job);
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;

    setAdvancing(true);
    try {
      const { data } = await axios.patch<Job>(`/api/jobs/${id}/status`, { status: next });
      setJob(data);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setToast(true);
      toastRef.current = setTimeout(() => setToast(false), 2500);
    } catch {
      Alert.alert('Error', 'Could not update status. Please try again.');
    } finally {
      setAdvancing(false);
    }
  };

  // ── Photo upload ───────────────────────────────────────────────────────────

  const addPhoto = async (photoLabel: 'before' | 'after') => {
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert('Permission needed', 'Camera access required.');
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
          if (!result.canceled && result.assets[0]) await processPhoto(result.assets[0].uri, photoLabel);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert('Permission needed', 'Photo library access required.');
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, allowsEditing: false });
          if (!result.canceled && result.assets[0]) await processPhoto(result.assets[0].uri, photoLabel);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const processPhoto = async (uri: string, photoLabel: 'before' | 'after') => {
    const itemId   = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const localUri = await copyToCache(uri, itemId).catch(() => uri);

    const item: LocalPhoto = { id: itemId, localUri, label: photoLabel, pct: 0, done: false, error: false };
    setPhotos(prev => [...prev, item]);
    uploadPhoto(item);
  };

  const uploadPhoto = async (item: LocalPhoto) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(item.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await axios.post(
        `/api/jobs/${id}/photos`,
        { label: item.label, photoBase64: `data:image/jpeg;base64,${base64}` },
        {
          onUploadProgress: (evt) => {
            const pct = Math.round((evt.loaded / (evt.total ?? evt.loaded)) * 100);
            setPhotos(prev => prev.map(p => p.id === item.id ? { ...p, pct } : p));
          },
        },
      );
      setPhotos(prev => prev.map(p => p.id === item.id ? { ...p, pct: 100, done: true } : p));
    } catch {
      setPhotos(prev => prev.map(p => p.id === item.id ? { ...p, error: true } : p));
    }
  };

  const removePhoto = (itemId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== itemId));
  };

  // ── Save note ──────────────────────────────────────────────────────────────

  const saveNote = async () => {
    setSavingNote(true);
    try {
      await axios.patch(`/api/jobs/${id}/notes`, { notes });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Could not save note.');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Stack.Screen options={{
          headerShown: true,
          title: 'Job Detail',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
        }} />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Stack.Screen options={{
          headerShown: true,
          title: 'Job Detail',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
        }} />
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={s.errText}>Job not found.</Text>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const currentStatus = resolveStatus(job);
  const stepIdx       = STEPS.findIndex(s => s.status === currentStatus);
  const nextStatus    = NEXT_STATUS[currentStatus];
  const advanceLabel  = ADVANCE_LABELS[currentStatus];
  const isFinished    = currentStatus === 'finished';

  const beforePhotos = photos.filter(p => p.label === 'before');
  const afterPhotos  = photos.filter(p => p.label === 'after');

  const vehicleLine = [job.vehicleMake, job.vehicleModel].filter(Boolean).join(' ') || job.vehicleLabel || '';
  const locationLine = job.locationType === 'mobile'
    ? (job.mobileAddress || 'Mobile')
    : (job.bayLabel || 'Bay');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Job Detail',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} style={{ paddingRight: 8 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </Pressable>
          ),
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { color: Colors.white, fontWeight: '700' },
        }}
      />

      <SafeAreaView style={s.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Vehicle + Customer card ── */}
          <ReAnimated.View entering={FadeInDown.delay(60).springify()} style={s.card}>
            <View style={s.cardIconRow}>
              <View style={s.carIcon}>
                <Ionicons name="car-sport-outline" size={22} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.customerName}>{job.customerName || 'Customer'}</Text>
                {vehicleLine ? (
                  <View style={s.vehicleRow}>
                    <Text style={s.vehicleText}>{vehicleLine}</Text>
                    {job.vehiclePlate ? (
                      <View style={s.plateBadge}>
                        <Text style={s.plateText}>{job.vehiclePlate}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.infoGrid}>
              <View style={s.infoItem}>
                <Ionicons name="cut-outline" size={14} color={Colors.textMuted} />
                <Text style={s.infoText} numberOfLines={1}>
                  {job.serviceName || job.serviceLabel || '—'}
                  {job.duration ? `  ·  ${job.duration} min` : ''}
                </Text>
              </View>
              <View style={s.infoItem}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={s.infoText}>
                  {job.appointmentDate}{'  ·  '}{formatTime(job.appointmentTime)}
                </Text>
              </View>
              <View style={s.infoItem}>
                <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                <Text style={s.infoText}>{locationLine}</Text>
              </View>
            </View>
          </ReAnimated.View>

          {/* ── Status stepper ── */}
          <ReAnimated.View entering={FadeInDown.delay(100).springify()} style={s.card}>
            <Text style={s.sectionLabel}>Job Progress</Text>

            {STEPS.map((step, i) => {
              const done   = i < stepIdx;
              const active = i === stepIdx;
              const isLast = i === STEPS.length - 1;

              return (
                <View key={step.status} style={s.stepRow}>
                  {/* Left indicator column */}
                  <View style={s.stepIndicatorCol}>
                    <StepCircle done={done} active={active} number={i + 1} />
                    {!isLast && (
                      <View style={[s.connector, done && { backgroundColor: Colors.success }]} />
                    )}
                  </View>

                  {/* Content */}
                  <View style={[s.stepContent, !isLast && { paddingBottom: 20 }]}>
                    <Text style={[
                      s.stepLabel,
                      active && s.stepLabelActive,
                      done   && s.stepLabelDone,
                    ]}>
                      {step.label}
                    </Text>
                    {active && <Text style={s.stepSub}>Current step</Text>}
                    {done   && <Text style={s.stepSub}>Completed</Text>}
                  </View>
                </View>
              );
            })}

            {/* Advance button */}
            {!isFinished && nextStatus && (
              <Pressable
                style={[s.advanceBtn, advancing && { opacity: 0.65 }]}
                onPress={advanceStatus}
                disabled={advancing}
                android_ripple={{ color: Colors.white + '30', borderless: false }}
              >
                {advancing
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={s.advanceBtnText}>{advanceLabel}</Text>
                }
              </Pressable>
            )}

            {isFinished && (
              <View style={s.finishedBanner}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={s.finishedText}>Job Complete</Text>
              </View>
            )}
          </ReAnimated.View>

          {/* ── Before / After photos ── */}
          <ReAnimated.View entering={FadeInDown.delay(140).springify()} style={s.card}>
            <Text style={s.sectionLabel}>Before &amp; After Photos</Text>

            <View style={s.photoColumns}>
              {/* Before column */}
              <View style={s.photoCol}>
                <Text style={s.photoColLabel}>Before</Text>
                {beforePhotos.map(item => (
                  <PhotoThumb key={item.id} item={item} onRemove={() => removePhoto(item.id)} />
                ))}
                <Pressable
                  style={s.addPhotoBtn}
                  onPress={() => addPhoto('before')}
                  android_ripple={{ color: Colors.accent + '20', borderless: false }}
                >
                  <Ionicons name="add" size={20} color={Colors.accent} />
                  <Text style={s.addPhotoBtnText}>Add Before</Text>
                </Pressable>
              </View>

              {/* After column */}
              <View style={s.photoCol}>
                <Text style={s.photoColLabel}>After</Text>
                {afterPhotos.map(item => (
                  <PhotoThumb key={item.id} item={item} onRemove={() => removePhoto(item.id)} />
                ))}
                <Pressable
                  style={s.addPhotoBtn}
                  onPress={() => addPhoto('after')}
                  android_ripple={{ color: Colors.accent + '20', borderless: false }}
                >
                  <Ionicons name="add" size={20} color={Colors.accent} />
                  <Text style={s.addPhotoBtnText}>Add After</Text>
                </Pressable>
              </View>
            </View>
          </ReAnimated.View>

          {/* ── Notes ── */}
          <ReAnimated.View entering={FadeInDown.delay(180).springify()} style={s.card}>
            <Text style={s.sectionLabel}>Staff Notes</Text>
            <TextInput
              style={s.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this job…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Pressable
              style={[s.saveNoteBtn, savingNote && { opacity: 0.65 }]}
              onPress={saveNote}
              disabled={savingNote}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              {savingNote
                ? <ActivityIndicator size="small" color={Colors.accent} />
                : <>
                    <Ionicons name="save-outline" size={16} color={Colors.accent} />
                    <Text style={s.saveNoteBtnText}>Save Note</Text>
                  </>
              }
            </Pressable>
          </ReAnimated.View>

        </ScrollView>

        {/* ── Customer notified toast ── */}
        <Toast visible={toast} />
      </SafeAreaView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: 100 },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  errText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  backBtn: { backgroundColor: Colors.accent, borderRadius: borderRadius.full, paddingHorizontal: 24, paddingVertical: 10, overflow: 'hidden' },
  backBtnText: { color: Colors.white, fontWeight: '700' },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },

  // Vehicle + customer card
  cardIconRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  carIcon:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  vehicleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  vehicleText:  { fontSize: 14, color: Colors.textSecondary },
  plateBadge:   { backgroundColor: Colors.accentMuted, borderRadius: 4, borderWidth: 1, borderColor: Colors.accent, paddingHorizontal: 7, paddingVertical: 2 },
  plateText:    { fontSize: 11, fontWeight: '800', color: Colors.accent, letterSpacing: 0.5 },
  divider:      { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  infoGrid:     { gap: 8 },
  infoItem:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText:     { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  // Stepper
  stepRow:          { flexDirection: 'row', gap: 14 },
  stepIndicatorCol: { alignItems: 'center', width: 32 },
  connector:        { width: 2, flex: 1, backgroundColor: Colors.border, marginTop: 4, minHeight: 20 },
  stepContent:      { flex: 1, paddingTop: 6 },
  stepLabel:        { fontSize: 15, fontWeight: '500', color: Colors.textMuted },
  stepLabelActive:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  stepLabelDone:    { color: Colors.textSecondary },
  stepSub:          { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  advanceBtn: {
    marginTop: 20,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    overflow: 'hidden',
    ...cardShadow,
  },
  advanceBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  finishedBanner: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
  },
  finishedText: { fontSize: 15, fontWeight: '700', color: Colors.success },

  // Photos
  photoColumns:  { flexDirection: 'row', gap: 12 },
  photoCol:      { flex: 1 },
  photoColLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, textAlign: 'center' },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    backgroundColor: Colors.accentMuted + '60',
    overflow: 'hidden',
  },
  addPhotoBtnText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // Notes
  notesInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: borderRadius.md,
    padding: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 100,
    marginBottom: 12,
    backgroundColor: Colors.background,
  },
  saveNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    minHeight: 44,
    overflow: 'hidden',
  },
  saveNoteBtnText: { fontSize: 14, fontWeight: '700', color: Colors.accent },
});
