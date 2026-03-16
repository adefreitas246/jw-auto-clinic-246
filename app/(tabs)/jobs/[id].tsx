// app/(tabs)/jobs/[id].tsx — Staff Job Workflow
// Status stepper, photo capture / gallery upload with progress, staff notes.
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as FileSystem   from 'expo-file-system';
import * as ImagePicker  from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Modal,
  Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import {
  ADVANCE_BUTTON_LABELS, JobStatus, JobTracking,
  NEXT_JOB_STATUS, STAFF_STATUS_COLORS, STAFF_STATUS_LABELS,
  JOB_STEPS,
} from '@/types/job';
import { useAuth }          from '@/context/AuthContext';
import VoiceNoteRecorder    from '@/components/VoiceNoteRecorder';
import VoiceNotePlayer, { VoiceNoteMeta } from '@/components/VoiceNotePlayer';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

// ─── Photo item type ──────────────────────────────────────────────────────────
interface PhotoItem {
  id:        string;
  localUri:  string;
  label:     'before' | 'after';
  pct:       number;
  done:      boolean;
  error:     boolean;
}

// ─── Job photo cache directory ────────────────────────────────────────────────
const CACHE_DIR = (FileSystem.cacheDirectory ?? '') + 'job-photos/';

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

async function copyToCache(uri: string, id: string): Promise<string> {
  await ensureCacheDir();
  const dest = CACHE_DIR + id + '.jpg';
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

// ─── Animated step dot ────────────────────────────────────────────────────────
function StepDot({ done, active }: { done: boolean; active: boolean }) {
  const scale = useRef(new Animated.Value(done || active ? 1 : 0.7)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: done || active ? 1 : 0.7, useNativeDriver: true }).start();
  }, [done, active]);
  const bg = done ? Colors.accent : active ? Colors.accent : Colors.border;
  return (
    <Animated.View style={[wf.dot, { backgroundColor: bg, transform: [{ scale }] }]}>
      {done  ? <Ionicons name="checkmark" size={12} color={Colors.white} /> : null}
      {active && !done ? <View style={wf.dotPulse} /> : null}
    </Animated.View>
  );
}

// ─── Vertical stepper ─────────────────────────────────────────────────────────
function JobStepper({ status }: { status: JobStatus }) {
  const idx = JOB_STEPS.findIndex(s => s.status === status);
  return (
    <View>
      {JOB_STEPS.map((step, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <View key={step.status}>
            <View style={wf.stepRow}>
              <StepDot done={done} active={active} />
              <Text style={[wf.stepLabel, (done || active) && wf.stepLabelOn]}>
                {STAFF_STATUS_LABELS[step.status]}
              </Text>
              {active && (
                <View style={[wf.activePill, { backgroundColor: STAFF_STATUS_COLORS[step.status].bg }]}>
                  <Text style={[wf.activePillText, { color: STAFF_STATUS_COLORS[step.status].text }]}>
                    Current
                  </Text>
                </View>
              )}
            </View>
            {i < JOB_STEPS.length - 1 && (
              <View style={[wf.connector, done && wf.connectorDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Photo thumbnail ──────────────────────────────────────────────────────────
function PhotoThumb({ item, onRemove }: { item: PhotoItem; onRemove: () => void }) {
  return (
    <View style={wf.thumbWrap}>
      <Image source={{ uri: item.localUri }} style={wf.thumb} />

      <View style={[wf.thumbLabel, item.label === 'before' ? wf.thumbBefore : wf.thumbAfter]}>
        <Text style={wf.thumbLabelText}>{item.label}</Text>
      </View>

      {!item.done && !item.error && (
        <View style={wf.thumbOverlay}>
          <View style={[wf.progressBar, { width: `${item.pct}%` as any }]} />
          <Text style={wf.progressText}>{item.pct}%</Text>
        </View>
      )}

      {item.done && (
        <View style={wf.thumbBadge}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        </View>
      )}

      {item.error && (
        <View style={wf.thumbBadge}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
        </View>
      )}

      {(item.done || item.error) && (
        <Pressable
          style={wf.thumbRemove}
          onPress={onRemove}
          hitSlop={6}
          android_ripple={{ color: Colors.border, radius: 14 }}
        >
          <Ionicons name="close-circle" size={18} color={Colors.white} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Camera modal ─────────────────────────────────────────────────────────────
function JobCameraModal({
  visible,
  label,
  onCapture,
  onClose,
}: {
  visible:   boolean;
  label:     'before' | 'after';
  onCapture: (uri: string) => void;
  onClose:   () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing,     setFacing]         = useState<CameraType>('back');
  const [capturing,  setCapturing]      = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const shoot = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality:    0.8,
        base64:     false,
        skipProcessing: false,
      });
      if (photo?.uri) onCapture(photo.uri);
    } finally {
      setCapturing(false);
    }
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible animationType="slide">
        <View style={cam.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide">
        <SafeAreaView style={cam.safe}>
          <View style={cam.permBox}>
            <View style={cam.permIconWrap}>
              <Ionicons name="camera-outline" size={40} color={Colors.accent} />
            </View>
            <Text style={cam.permTitle}>Camera Access Needed</Text>
            <Text style={cam.permSub}>
              Allow camera access to take before/after photos.
            </Text>
            <Pressable
              style={cam.permBtn}
              onPress={requestPermission}
              android_ripple={{ color: Colors.primaryDark }}
            >
              <Text style={cam.permBtnText}>Grant Permission</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={cam.permCancel}
              hitSlop={8}
              android_ripple={{ color: Colors.border }}
            >
              <Text style={cam.permCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={cam.container}>
        <CameraView ref={cameraRef} style={cam.camera} facing={facing}>
          <SafeAreaView style={cam.topBar} edges={['top']}>
            <Pressable style={cam.iconBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={26} color={Colors.white} />
            </Pressable>
            <View style={[cam.labelBadge, label === 'before' ? cam.labelBefore : cam.labelAfter]}>
              <Text style={cam.labelText}>{label.toUpperCase()}</Text>
            </View>
            <Pressable
              style={cam.iconBtn}
              onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
              hitSlop={8}
            >
              <Ionicons name="camera-reverse-outline" size={26} color={Colors.white} />
            </Pressable>
          </SafeAreaView>

          <View style={cam.shutterRow}>
            <TouchableOpacity style={cam.shutter} onPress={shoot} disabled={capturing}>
              {capturing
                ? <ActivityIndicator color={Colors.accent} />
                : <View style={cam.shutterInner} />
              }
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function JobWorkflowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [job,            setJob]            = useState<JobTracking | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [advancing,      setAdvancing]      = useState(false);
  const [photos,         setPhotos]         = useState<PhotoItem[]>([]);
  const [label,          setLabel]          = useState<'before' | 'after'>('before');
  const [notes,          setNotes]          = useState('');
  const [cameraOpen,     setCameraOpen]     = useState(false);
  const [voiceNotes,     setVoiceNotes]     = useState<VoiceNoteMeta[]>([]);
  const [recorderOpen,   setRecorderOpen]   = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await axios.get<JobTracking>(`/api/jobs/${id}`);
      setJob(data);
      setNotes(data.staffNotes ?? '');
      if (data.photos?.length) {
        setPhotos(data.photos.map(p => ({
          id:       p._id,
          localUri: p.data,
          label:    p.label,
          pct:      100,
          done:     true,
          error:    false,
        })));
      }
    } catch {
      Alert.alert('Error', 'Could not load job details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Fetch voice notes ──────────────────────────────────────────────────────
  const fetchVoiceNotes = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await axios.get<VoiceNoteMeta[]>(
        `/api/jobs/${id}/voice-notes?include_data=1`
      );
      setVoiceNotes(data);
    } catch {
      // Non-critical
    }
  }, [id]);

  useEffect(() => { fetchJob(); fetchVoiceNotes(); }, [fetchJob, fetchVoiceNotes]);

  // ── Advance status ────────────────────────────────────────────────────────
  const advanceStatus = async () => {
    if (!job) return;
    const next = NEXT_JOB_STATUS[job.jobStatus];
    if (!next) return;

    setAdvancing(true);
    try {
      const { data } = await axios.patch(`/api/jobs/${id}/status`, {
        jobStatus: next,
        notes,
      });
      setJob(data);
    } catch {
      Alert.alert('Error', 'Could not update job status. Please try again.');
    } finally {
      setAdvancing(false);
    }
  };

  // ── Photo pipeline ────────────────────────────────────────────────────────
  const handleCapturedUri = async (uri: string) => {
    setCameraOpen(false);
    await processPhoto(uri);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality:    0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await processPhoto(result.assets[0].uri);
    }
  };

  const processPhoto = async (uri: string) => {
    const itemId   = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const localUri = await copyToCache(uri, itemId).catch(() => uri);

    const item: PhotoItem = {
      id: itemId, localUri, label, pct: 0, done: false, error: false,
    };
    setPhotos(prev => [...prev, item]);
    uploadPhoto(item);
  };

  const uploadPhoto = async (item: PhotoItem) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(item.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      await axios.post(
        `/api/jobs/${id}/photos`,
        { label: item.label, photoBase64: dataUrl },
        {
          onUploadProgress: (evt) => {
            const pct = Math.round((evt.loaded / (evt.total ?? evt.loaded)) * 100);
            setPhotos(prev =>
              prev.map(p => p.id === item.id ? { ...p, pct } : p)
            );
          },
        }
      );

      setPhotos(prev =>
        prev.map(p => p.id === item.id ? { ...p, pct: 100, done: true } : p)
      );
    } catch {
      setPhotos(prev =>
        prev.map(p => p.id === item.id ? { ...p, error: true } : p)
      );
    }
  };

  const retryUpload = (item: PhotoItem) => {
    setPhotos(prev =>
      prev.map(p => p.id === item.id ? { ...p, pct: 0, done: false, error: false } : p)
    );
    uploadPhoto(item);
  };

  const removePhoto = (itemId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== itemId));
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={wf.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={wf.centered}>
        <View style={wf.errorIconWrap}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
        </View>
        <Text style={wf.errText}>Job not found.</Text>
        <Pressable
          style={wf.retryBtn}
          onPress={() => router.back()}
          android_ripple={{ color: Colors.primaryDark }}
        >
          <Text style={wf.retryText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const nextStatus = NEXT_JOB_STATUS[job.jobStatus];
  const advLabel   = ADVANCE_BUTTON_LABELS[job.jobStatus];
  const isDone     = job.jobStatus === 'finished';

  return (
    <SafeAreaView style={wf.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={wf.header}>
        <Pressable
          style={wf.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={8}
          android_ripple={{ color: Colors.border, borderless: true, radius: 20 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={wf.headerTitle} numberOfLines={1}>{job.serviceLabel}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={wf.scroll}
        contentContainerStyle={wf.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Job summary card ── */}
        <View style={wf.card}>
          <Text style={wf.svcName}>{job.serviceLabel}</Text>
          <View style={wf.divider} />

          <View style={wf.infoRow}>
            <View style={wf.infoIconWrap}>
              <Ionicons name="car-outline" size={14} color={Colors.accent} />
            </View>
            <Text style={wf.infoText}>{job.vehicleLabel || 'No vehicle info'}</Text>
          </View>
          <View style={wf.infoRow}>
            <View style={wf.infoIconWrap}>
              <Ionicons name="time-outline" size={14} color={Colors.accent} />
            </View>
            <Text style={wf.infoText}>
              {job.appointmentDate} · {job.appointmentTime}
            </Text>
          </View>
          <View style={wf.infoRow}>
            <View style={wf.infoIconWrap}>
              <Ionicons
                name={job.locationType === 'mobile' ? 'navigate' : 'business'}
                size={14} color={Colors.accent}
              />
            </View>
            <Text style={wf.infoText}>
              {job.locationType === 'mobile'
                ? (job.mobileAddress || 'Mobile service')
                : (job.bayLabel || 'Bay service')}
            </Text>
          </View>
          <View style={[wf.infoRow, { marginBottom: 0 }]}>
            <View style={wf.infoIconWrap}>
              <Ionicons name="cash-outline" size={14} color={Colors.accent} />
            </View>
            <Text style={wf.infoText}>
              ${job.totalPrice.toFixed(2)} · {job.durationMinutes} min
            </Text>
          </View>
        </View>

        {/* ── Status stepper ── */}
        <View style={wf.card}>
          <Text style={wf.sectionTitle}>Job Progress</Text>
          <JobStepper status={job.jobStatus} />
        </View>

        {/* ── Advance status button ── */}
        {!isDone && nextStatus && (
          <Pressable
            style={({ pressed }) => [
              wf.advanceBtn,
              pressed && { opacity: 0.88 },
              advancing && { opacity: 0.6 },
            ]}
            onPress={advanceStatus}
            disabled={advancing}
            android_ripple={{ color: Colors.primaryDark }}
          >
            {advancing ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="arrow-forward-circle" size={20} color={Colors.white} />
                <Text style={wf.advanceBtnText}>{advLabel}</Text>
              </>
            )}
          </Pressable>
        )}

        {isDone && (
          <View style={wf.doneCard}>
            <View style={wf.doneIconWrap}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            </View>
            <Text style={wf.doneText}>Job Finished — Customer Notified</Text>
          </View>
        )}

        {/* ── Photos section ── */}
        <View style={wf.card}>
          <Text style={wf.sectionTitle}>Photos</Text>

          {/* Label toggle */}
          <View style={wf.labelToggle}>
            {(['before', 'after'] as const).map(l => (
              <Pressable
                key={l}
                style={[wf.labelBtn, label === l && wf.labelBtnActive]}
                onPress={() => setLabel(l)}
                android_ripple={{ color: Colors.accent }}
              >
                <Text style={[wf.labelBtnText, label === l && wf.labelBtnTextActive]}>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Capture buttons */}
          <View style={wf.captureRow}>
            <Pressable
              style={({ pressed }) => [wf.captureBtn, pressed && { opacity: 0.82 }]}
              onPress={() => setCameraOpen(true)}
              android_ripple={{ color: Colors.accent }}
            >
              <Ionicons name="camera" size={18} color={Colors.accent} />
              <Text style={wf.captureBtnText}>Take Photo</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [wf.captureBtn, pressed && { opacity: 0.82 }]}
              onPress={pickFromGallery}
              android_ripple={{ color: Colors.accent }}
            >
              <Ionicons name="images" size={18} color={Colors.accent} />
              <Text style={wf.captureBtnText}>Gallery</Text>
            </Pressable>
          </View>

          {/* Photo grid */}
          {photos.length > 0 ? (
            <View style={wf.photoGrid}>
              {photos.map(item => (
                <PhotoThumb
                  key={item.id}
                  item={item}
                  onRemove={() => item.error ? retryUpload(item) : removePhoto(item.id)}
                />
              ))}
            </View>
          ) : (
            <View style={wf.emptyState}>
              <Ionicons name="image-outline" size={32} color={Colors.border} />
              <Text style={wf.emptyStateText}>No photos added yet</Text>
            </View>
          )}
        </View>

        {/* ── Staff notes ── */}
        <View style={wf.card}>
          <Text style={wf.sectionTitle}>Staff Notes</Text>
          <TextInput
            style={wf.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this job…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Pressable
            style={({ pressed }) => [wf.saveNotesBtn, pressed && { opacity: 0.82 }]}
            onPress={async () => {
              try {
                await axios.patch(`/api/jobs/${id}/status`, {
                  jobStatus: job.jobStatus,
                  notes,
                });
                Alert.alert('Saved', 'Notes saved successfully.');
              } catch {
                Alert.alert('Error', 'Could not save notes.');
              }
            }}
            android_ripple={{ color: Colors.accent }}
          >
            <Ionicons name="save-outline" size={16} color={Colors.accent} />
            <Text style={wf.saveNotesBtnText}>Save Notes</Text>
          </Pressable>
        </View>

        {/* ── Voice notes ── */}
        <View style={wf.card}>
          <View style={wf.sectionHeaderRow}>
            <Text style={[wf.sectionTitle, { marginBottom: 0 }]}>Voice Notes</Text>
            {!recorderOpen && (
              <Pressable
                style={wf.micBtn}
                onPress={() => setRecorderOpen(true)}
                hitSlop={6}
                android_ripple={{ color: Colors.accent }}
              >
                <Ionicons name="mic-outline" size={15} color={Colors.accent} />
                <Text style={wf.micBtnText}>Record</Text>
              </Pressable>
            )}
          </View>

          {recorderOpen && (
            <View style={{ marginBottom: 14 }}>
              <VoiceNoteRecorder
                jobId={id!}
                token={token ?? ''}
                onSaved={(_note) => {
                  setRecorderOpen(false);
                  fetchVoiceNotes();
                }}
                onCancel={() => setRecorderOpen(false)}
              />
            </View>
          )}

          {voiceNotes.length === 0 && !recorderOpen ? (
            <View style={wf.emptyState}>
              <Ionicons name="mic-outline" size={32} color={Colors.border} />
              <Text style={wf.emptyStateText}>No voice notes yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {voiceNotes.map(note => (
                <VoiceNotePlayer key={note._id} note={note} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Camera modal ── */}
      <JobCameraModal
        visible={cameraOpen}
        label={label}
        onCapture={handleCapturedUri}
        onClose={() => setCameraOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const wf = StyleSheet.create({
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
    borderRadius: borderRadius.md,
    paddingHorizontal: 28, paddingVertical: 12,
    overflow: 'hidden',
  },
  retryText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

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
  headerTitle: {
    fontSize: 16, fontWeight: '800', color: Colors.textPrimary,
    flex: 1, textAlign: 'center', marginHorizontal: 8,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    marginTop: 4,
    ...cardShadow,
  },
  sectionTitle:     { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  divider:          { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: 16 },

  micBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    overflow: 'hidden',
  },
  micBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  // Summary
  svcName:     { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoIconWrap:{ width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  infoText:    { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  // Stepper
  stepRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dot:           { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotPulse:      { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white },
  stepLabel:     { fontSize: 14, fontWeight: '600', color: Colors.border, flex: 1 },
  stepLabelOn:   { color: Colors.textPrimary },
  activePill:    { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  activePillText:{ fontSize: 11, fontWeight: '700' },
  connector:     { width: 2, height: 20, backgroundColor: Colors.border, marginLeft: 13, marginVertical: 2 },
  connectorDone: { backgroundColor: Colors.accent },

  // Advance button
  advanceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
    ...cardShadow,
  },
  advanceBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  // Done card
  doneCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.successBg,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  doneIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  doneText: { fontSize: 14, fontWeight: '700', color: Colors.success, flex: 1 },

  // Label toggle
  labelToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  labelBtn: {
    flex: 1, paddingVertical: 10, borderRadius: borderRadius.sm,
    alignItems: 'center', backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
    overflow: 'hidden',
  },
  labelBtnActive:     { backgroundColor: Colors.accentMuted, borderColor: Colors.accent },
  labelBtnText:       { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  labelBtnTextActive: { color: Colors.accent },

  // Capture buttons
  captureRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  captureBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  captureBtnText: { fontSize: 14, fontWeight: '700', color: Colors.accent },

  // Photo grid
  photoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap:  { width: 88, height: 88, borderRadius: borderRadius.sm, overflow: 'hidden', position: 'relative' },
  thumb:      { width: '100%', height: '100%' },
  thumbLabel: {
    position: 'absolute', top: 4, left: 4,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  thumbBefore:    { backgroundColor: 'rgba(0,0,0,0.6)' },
  thumbAfter:     { backgroundColor: 'rgba(106,13,173,0.8)' },
  thumbLabelText: { color: Colors.white, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  thumbOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 6, alignItems: 'center',
  },
  progressBar: { height: 3, backgroundColor: Colors.accent, position: 'absolute', top: 0, left: 0 },
  progressText:{ color: Colors.white, fontSize: 11, fontWeight: '700' },
  thumbBadge:  { position: 'absolute', bottom: 4, right: 4 },
  thumbRemove: { position: 'absolute', top: 2, right: 2 },

  emptyState:     { alignItems: 'center', paddingVertical: 28 },
  emptyStateText: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },

  // Notes
  notesInput: {
    backgroundColor: Colors.background,
    borderRadius: borderRadius.sm,
    padding: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 104,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  saveNotesBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.sm,
    paddingVertical: 11,
    overflow: 'hidden',
  },
  saveNotesBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
});

// ─── Camera modal styles ──────────────────────────────────────────────────────
const cam = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  camera:    { flex: 1 },
  safe:      { flex: 1, backgroundColor: Colors.textPrimary },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  labelBadge:  { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  labelBefore: { backgroundColor: 'rgba(0,0,0,0.6)' },
  labelAfter:  { backgroundColor: 'rgba(106,13,173,0.75)' },
  labelText:   { color: Colors.white, fontWeight: '800', fontSize: 14, letterSpacing: 1.5 },

  shutterRow: {
    position: 'absolute', bottom: 48, left: 0, right: 0,
    alignItems: 'center',
  },
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.white,
    borderWidth: 2, borderColor: Colors.border,
  },

  permBox:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permIconWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  permTitle:     { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  permSub:       { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  permBtn:       { backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingHorizontal: 32, paddingVertical: 13, overflow: 'hidden' },
  permBtnText:   { color: Colors.white, fontWeight: '700', fontSize: 15 },
  permCancel:    { paddingVertical: 10, overflow: 'hidden' },
  permCancelText:{ color: Colors.textMuted, fontSize: 14 },
});
