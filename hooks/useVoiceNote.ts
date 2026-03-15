// hooks/useVoiceNote.ts
// expo-audio AudioRecorder wrapper for staff voice notes.
//
// Usage:
//   const { state, duration, uri, startRecording, stopRecording, cancelRecording, reset } = useVoiceNote();
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
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

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    // iOS: allow recording even when ringer is silent
    await setAudioModeAsync({
      allowsRecording:   true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
    recorder.record();

    setState('recording');
    setDuration(0);
    setUri(null);

    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await recorder.stop();
    const fileUri = recorder.uri ?? null;

    // Restore audio mode so the player can play back through speaker
    await setAudioModeAsync({
      allowsRecording:   false,
      playsInSilentMode: true,
    });

    setState('stopped');
    setUri(fileUri);
    return fileUri;
  }, [recorder]);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try { await recorder.stop(); } catch {}
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setState('idle');
    setDuration(0);
    setUri(null);
  }, [recorder]);

  const reset = useCallback(() => {
    setState('idle');
    setDuration(0);
    setUri(null);
  }, []);

  return { state, duration, uri, startRecording, stopRecording, cancelRecording, reset };
}
