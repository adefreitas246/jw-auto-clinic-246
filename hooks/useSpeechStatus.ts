// hooks/useSpeechStatus.ts
// Wraps expo-speech for customer job-status readout.
//
// • Reads user preference from AsyncStorage key 'voice_status_enabled'
// • Checks silent mode via expo-av before speaking
// • Stops any in-progress speech on unmount
//
// Usage:
//   const { speak, stop, voiceEnabled, setVoiceEnabled } = useSpeechStatus();
//
// Requires:
//   npx expo install expo-speech expo-av
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'voice_status_enabled';

export type UseSpeechStatus = {
  voiceEnabled:    boolean;
  setVoiceEnabled: (enabled: boolean) => Promise<void>;
  speak:           (text: string, language?: string) => Promise<void>;
  stop:            () => void;
};

export function useSpeechStatus(): UseSpeechStatus {
  const [voiceEnabled, setVoiceEnabledState] = useState(false);

  // Load preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      // Default OFF — user must opt in via accessibility settings
      setVoiceEnabledState(val === 'true');
    });
    return () => { Speech.stop(); };
  }, []);

  const setVoiceEnabled = useCallback(async (enabled: boolean) => {
    setVoiceEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  }, []);

  const speak = useCallback(async (text: string, language = 'en-US') => {
    if (!voiceEnabled) return;

    // Check if audio is available (respects silent mode on iOS)
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   false,
        playsInSilentModeIOS: false, // won't play if silent mode is on
        staysActiveInBackground: false,
      });
    } catch {
      // If audio setup fails, skip speech
      return;
    }

    Speech.stop();
    Speech.speak(text, { language, rate: 0.9, pitch: 1.0 });
  }, [voiceEnabled]);

  const stop = useCallback(() => { Speech.stop(); }, []);

  return { voiceEnabled, setVoiceEnabled, speak, stop };
}
