// components/VoiceNotePlayer.tsx
// Plays back a voice note stored as a base64 data URI.
// Used on the admin job detail view.
//
// Props:
//   note — { _id, data, mimeType, duration, label, takenAt, staffId? }
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import {
import { Colors } from '@/constants/Colors';
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
  const player    = useAudioPlayer(null);
  const status    = useAudioPlayerStatus(player);

  const [hasSource,  setHasSource]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  // Derived from live status; fall back to note.duration before anything loads
  const posMs    = status.currentTime * 1000;
  const durMs    = status.duration > 0 ? status.duration * 1000 : (note.duration ?? 0) * 1000;
  const playing  = status.playing;
  const progress = durMs > 0 ? posMs / durMs : 0;

  // Clear loading spinner once the audio is loaded
  useEffect(() => {
    if (hasSource && status.isLoaded) {
      setLoading(false);
    }
  }, [hasSource, status.isLoaded]);

  // Seek back to the start after playback naturally finishes
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (wasPlayingRef.current && !status.playing && status.isLoaded) {
      const isAtEnd = status.duration > 0 && status.currentTime >= status.duration - 0.5;
      if (isAtEnd) {
        player.seekTo(0);
      }
    }
    wasPlayingRef.current = status.playing;
  }, [status.playing]);

  async function loadAndPlay() {
    if (!note.data) {
      setLoadError('Audio data unavailable — re-open this job to load it.');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      await setAudioModeAsync({
        allowsRecording:   false,
        playsInSilentMode: true,
      });

      player.replace({ uri: note.data });
      setHasSource(true);
      player.play();
    } catch {
      setLoadError('Could not play recording.');
      setLoading(false);
    }
  }

  async function handleToggle() {
    if (loading) return;

    if (!hasSource) {
      await loadAndPlay();
      return;
    }

    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  return (
    <View style={vp.card}>
      {/* Play / pause button */}
      <Pressable
        style={vp.playBtn}
        onPress={handleToggle}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color={Colors.white} />
          : <Ionicons name={playing ? 'pause' : 'play'} size={18} color={Colors.white} />
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
      <Ionicons name="mic-outline" size={15} color={Colors.textMuted} style={{ marginLeft: 4 }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const vp = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  playBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },

  progressTrack: { height: 4, backgroundColor: Colors.border, borderRadius: 99, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.accent, borderRadius: 99 },

  timeRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeText: { fontSize: 11, color: Colors.textMuted, fontVariant: ['tabular-nums'] as any },
  dateText: { fontSize: 10, color: Colors.border },

  label:   { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  errText: { fontSize: 11, color: Colors.error },
});
