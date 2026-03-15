// components/VoiceNotePlayer.tsx
// Plays back a voice note stored as a base64 data URI.
// Used on the admin job detail view.
//
// Props:
//   note — { _id, data, mimeType, duration, label, takenAt, staffId? }
//
// Requires:
//   npx expo install expo-av
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour:  '2-digit', minute: '2-digit',
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceNoteMeta = {
  _id:      string;
  data?:    string; // base64 URI — required for playback; may be absent in list responses
  mimeType: string;
  duration: number; // seconds (approximate, from recording)
  label:    string;
  takenAt:  string;
  staffId?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoiceNotePlayer({ note }: { note: VoiceNoteMeta }) {
  const soundRef   = useRef<Audio.Sound | null>(null);
  const [playing,   setPlaying]   = useState(false);
  const [posMs,     setPosMs]     = useState(0);
  const [durMs,     setDurMs]     = useState((note.duration ?? 0) * 1000);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Unload sound on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function loadAndPlay() {
    if (!note.data) {
      setLoadError('Audio data unavailable — re-open this job to load it.');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      // Unload any previous instance
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: note.data },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
    } catch (err: any) {
      setLoadError('Could not play recording.');
      setLoading(false);
    }
  }

  function onPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    setLoading(false);
    setPlaying(status.isPlaying);
    setPosMs(status.positionMillis ?? 0);
    if (status.durationMillis) setDurMs(status.durationMillis);
    if (status.didJustFinish) {
      setPlaying(false);
      setPosMs(0);
    }
  }

  async function handleToggle() {
    if (loading) return;

    if (!soundRef.current) {
      await loadAndPlay();
      return;
    }

    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      await loadAndPlay();
      return;
    }

    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      if (status.didJustFinish || status.positionMillis === status.durationMillis) {
        await soundRef.current.setPositionAsync(0);
      }
      await soundRef.current.playAsync();
    }
  }

  const progress = durMs > 0 ? posMs / durMs : 0;

  return (
    <View style={vp.card}>
      {/* Play / pause button */}
      <Pressable
        style={vp.playBtn}
        onPress={handleToggle}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
        }
      </Pressable>

      {/* Waveform placeholder + progress bar */}
      <View style={vp.info}>
        <View style={vp.progressTrack}>
          <View style={[vp.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={vp.timeRow}>
          <Text style={vp.timeText}>{formatMs(posMs)}</Text>
          {note.takenAt ? (
            <Text style={vp.dateText}>{formatDate(note.takenAt)}</Text>
          ) : null}
          <Text style={vp.timeText}>{formatMs(durMs)}</Text>
        </View>

        {note.label ? (
          <Text style={vp.label}>{note.label}</Text>
        ) : null}

        {loadError ? (
          <Text style={vp.errText}>{loadError}</Text>
        ) : null}
      </View>

      {/* Mic icon badge */}
      <Ionicons name="mic-outline" size={15} color="#9ca3af" style={{ marginLeft: 4 }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const vp = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  playBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#6a0dad',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },

  progressTrack: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 99, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#6a0dad', borderRadius: 99 },

  timeRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeText: { fontSize: 11, color: '#9ca3af', fontVariant: ['tabular-nums'] as any },
  dateText: { fontSize: 10, color: '#d1d5db' },

  label:   { fontSize: 11, color: '#6b7280', fontStyle: 'italic' },
  errText: { fontSize: 11, color: '#e53935' },
});
