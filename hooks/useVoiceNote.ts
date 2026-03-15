// hooks/useVoiceNote.ts
// expo-av Audio.Recording wrapper for staff voice notes.
//
// Usage:
//   const { state, duration, uri, startRecording, stopRecording, cancelRecording, reset } = useVoiceNote();
//
// Requires:
//   npx expo install expo-av
import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceNoteState = 'idle' | 'recording' | 'stopped';

export type UseVoiceNote = {
  state:           VoiceNoteState;
  duration:        number;        // seconds elapsed while recording
  uri:             string | null; // local file URI after stopping
  startRecording:  () => Promise<void>;
  stopRecording:   () => Promise<string | null>; // returns file URI
  cancelRecording: () => Promise<void>;
  reset:           () => void;
};

export function useVoiceNote(): UseVoiceNote {
  const [state,    setState]    = useState<VoiceNoteState>('idle');
  const [duration, setDuration] = useState(0);
  const [uri,      setUri]      = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current)     clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    // iOS: allow recording even when ringer is silent
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:    true,
      playsInSilentModeIOS:  true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    recordingRef.current = recording;
    setState('recording');
    setDuration(0);
    setUri(null);

    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!recordingRef.current) return null;

    await recordingRef.current.stopAndUnloadAsync();
    const fileUri = recordingRef.current.getURI() ?? null;
    recordingRef.current = null;

    // Restore audio mode so the player can play back through speaker
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:   false,
      playsInSilentModeIOS: true,
    });

    setState('stopped');
    setUri(fileUri);
    return fileUri;
  }, []);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    setState('idle');
    setDuration(0);
    setUri(null);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setDuration(0);
    setUri(null);
  }, []);

  return { state, duration, uri, startRecording, stopRecording, cancelRecording, reset };
}
