// components/VoiceNoteRecorder.tsx
// Staff voice note recording component.
// Renders a compact inline card that moves through three phases:
//   idle → recording → stopped (with upload option)
//
// Props:
//   jobId     — booking / job ID to upload against
//   token     — auth bearer token
//   onSaved   — called with the saved note metadata after successful upload
//   onCancel  — called when the user dismisses the recorder
//
// Requires:
//   npx expo install expo-av expo-file-system
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useVoiceNote } from '@/hooks/useVoiceNote';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Pulsing dot indicator ─────────────────────────────────────────────────────

function RecordingPulse() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[vr.pulse, { transform: [{ scale }] }]} />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type SavedNote = {
  _id:      string;
  duration: number;
  label:    string;
  takenAt:  string;
};

type Props = {
  jobId:    string;
  token:    string;
  onSaved:  (note: SavedNote) => void;
  onCancel: () => void;
};

export default function VoiceNoteRecorder({ jobId, token, onSaved, onCancel }: Props) {
  const { state, duration, uri, startRecording, stopRecording, cancelRecording, reset } = useVoiceNote();
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Start recording automatically on mount ────────────────────────────────
  useEffect(() => {
    startRecording().catch(err => {
      Alert.alert('Microphone Error', err.message ?? 'Could not start recording.');
      onCancel();
    });
  }, []);

  async function handleStop() {
    setError(null);
    const fileUri = await stopRecording();
    if (!fileUri) {
      setError('Recording failed — no audio captured.');
    }
  }

  async function handleUpload() {
    if (!uri) return;
    setUploading(true);
    setError(null);
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimeType = Platform.OS === 'android' ? 'audio/3gp' : 'audio/m4a';
      const dataUri  = `data:${mimeType};base64,${base64}`;

      const res = await axios.post(
        `/api/jobs/${jobId}/voice-notes`,
        { audioBase64: dataUri, mimeType, duration, label: '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      reset();
      onSaved(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCancel() {
    await cancelRecording();
    onCancel();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={vr.card}>
      {/* Header */}
      <View style={vr.header}>
        <Ionicons name="mic" size={18} color="#e53935" />
        <Text style={vr.headerText}>Voice Note</Text>
      </View>

      {/* Recording state */}
      {state === 'recording' && (
        <View style={vr.body}>
          <View style={vr.pulseRow}>
            <RecordingPulse />
            <Text style={vr.timerText}>{formatDuration(duration)}</Text>
            <Text style={vr.recLabel}>Recording…</Text>
          </View>
          <View style={vr.btnRow}>
            <Pressable style={vr.cancelBtn} onPress={handleCancel}>
              <Ionicons name="close" size={16} color="#6b7280" />
              <Text style={vr.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={vr.stopBtn} onPress={handleStop}>
              <Ionicons name="stop" size={18} color="#fff" />
              <Text style={vr.stopBtnText}>Stop</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Stopped — ready to upload */}
      {state === 'stopped' && (
        <View style={vr.body}>
          <View style={vr.doneRow}>
            <Ionicons name="checkmark-circle" size={22} color="#10b981" />
            <Text style={vr.doneText}>Recorded {formatDuration(duration)}</Text>
          </View>

          {error && <Text style={vr.errText}>{error}</Text>}

          <View style={vr.btnRow}>
            <Pressable style={vr.cancelBtn} onPress={handleCancel} disabled={uploading}>
              <Ionicons name="trash-outline" size={16} color="#6b7280" />
              <Text style={vr.cancelBtnText}>Discard</Text>
            </Pressable>
            <Pressable
              style={[vr.uploadBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              }
              <Text style={vr.uploadBtnText}>{uploading ? 'Saving…' : 'Save Note'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Idle — shouldn't normally show (auto-starts); shown briefly on first render */}
      {state === 'idle' && (
        <View style={vr.body}>
          <ActivityIndicator color="#6a0dad" />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const vr = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff1f2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
  },
  headerText: { fontSize: 13, fontWeight: '700', color: '#e53935' },

  body: { padding: 14, gap: 12 },

  // Recording row
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulse:    { width: 12, height: 12, borderRadius: 6, backgroundColor: '#e53935' },
  timerText:{ fontSize: 20, fontWeight: '900', color: '#1f2937', letterSpacing: 1 },
  recLabel: { fontSize: 12, color: '#6b7280', flex: 1 },

  // Done row
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneText: { fontSize: 14, fontWeight: '700', color: '#10b981' },

  // Buttons
  btnRow:    { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  stopBtn:   { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#e53935' },
  stopBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  uploadBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#6a0dad' },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  errText: { fontSize: 12, color: '#e53935', textAlign: 'center' },
});
