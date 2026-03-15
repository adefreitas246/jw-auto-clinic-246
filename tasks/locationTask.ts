// tasks/locationTask.ts
// Background GPS tracking for mobile wash technicians.
//
// IMPORTANT: This file MUST be imported at the app root (app/_layout.tsx) so
// TaskManager.defineTask executes before any component tries to register it.
//
// Flow:
//   startLocationTracking()  → stores credentials → registers expo-location task
//   Background task fires    → reads credentials → POSTs to PATCH /api/staff/:id/location
//   stopLocationTracking()   → stops task → clears credentials → ends shift on server
import * as Location    from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage     from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform }     from 'react-native';

import { SECURE_STORE_KEYS } from '@/constants/secureStoreKeys';

export const TECHNICIAN_LOCATION_TASK = 'TECHNICIAN_LOCATION_TASK';

// AsyncStorage keys used to share state with the background task
const TRACK_USER_ID  = '@washhub/trackUserId';
const TRACK_TOKEN    = '@washhub/trackToken';
const TRACK_API_URL  = '@washhub/trackApiUrl';

// ─── Credential helpers ───────────────────────────────────────────────────────
const secureGet = (key: string): Promise<string | null> =>
  Platform.OS === 'web'
    ? AsyncStorage.getItem(key)
    : SecureStore.getItemAsync(key);

// ─── Public helpers (called from the Tracking screen) ────────────────────────

export async function isLocationTaskRunning(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(TECHNICIAN_LOCATION_TASK);
}

export interface StartTrackingParams {
  userId:     string;
  apiUrl:     string;
  lowBattery?: boolean; // true → 60 s interval instead of 15 s
}

export async function startLocationTracking({
  userId,
  apiUrl,
  lowBattery = false,
}: StartTrackingParams): Promise<void> {
  // Read JWT from SecureStore (falls back to AsyncStorage on web)
  const token = await secureGet(SECURE_STORE_KEYS.AUTH_TOKEN);
  if (!token) throw new Error('No auth token — please log in again.');

  // Persist credentials for the background task context
  await AsyncStorage.multiSet([
    [TRACK_USER_ID, userId],
    [TRACK_TOKEN,   token],
    [TRACK_API_URL, apiUrl],
  ]);

  // Stop any existing instance before (re-)registering
  const already = await TaskManager.isTaskRegisteredAsync(TECHNICIAN_LOCATION_TASK);
  if (already) {
    await Location.stopLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK, {
    accuracy:         Location.Accuracy.High,
    timeInterval:     lowBattery ? 60_000 : 15_000, // 15 s normal / 60 s low battery
    distanceInterval: 20,                            // minimum 20 m movement

    // iOS: shows the blue location bar in the status bar
    showsBackgroundLocationIndicator: true,

    // Android: keeps the task alive via a persistent foreground service notification
    foregroundService: {
      notificationTitle:   'Wash Hub — Tracking Active',
      notificationBody:    'Your location is being shared with customers.',
      notificationColor:   '#6a0dad',
    },

    pausesUpdatesAutomatically: false,
  });
}

export async function stopLocationTracking({
  userId,
  apiUrl,
}: {
  userId: string;
  apiUrl: string;
}): Promise<void> {
  // Stop expo-location task
  try {
    const running = await TaskManager.isTaskRegisteredAsync(TECHNICIAN_LOCATION_TASK);
    if (running) {
      await Location.stopLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK);
    }
  } catch {}

  // Read token for the end-shift server call
  const token = await secureGet(SECURE_STORE_KEYS.AUTH_TOKEN);

  // Clear credentials
  await AsyncStorage.multiRemove([TRACK_USER_ID, TRACK_TOKEN, TRACK_API_URL]);

  // Notify the backend: clear coordinates + set isTracking = false
  if (token) {
    try {
      await fetch(`${apiUrl}/api/staff/${userId}/tracking`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ isTracking: false }),
      });
    } catch {}
  }
}

// ─── Background task definition ─────────────────────────────────────────────
// Must be called at module load time — NOT inside any function or component.

TaskManager.defineTask(
  TECHNICIAN_LOCATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error) {
      console.warn('[LocationTask] error:', error.message);
      return;
    }

    const locations = data?.locations;
    if (!locations?.length) return;

    // Read persisted credentials
    const [userId, token, apiUrl] = await Promise.all([
      AsyncStorage.getItem(TRACK_USER_ID),
      AsyncStorage.getItem(TRACK_TOKEN),
      AsyncStorage.getItem(TRACK_API_URL),
    ]);

    if (!userId || !token || !apiUrl) return;

    // Use the most recent fix
    const { latitude, longitude, accuracy } = locations[locations.length - 1].coords;

    try {
      await fetch(`${apiUrl}/api/staff/${userId}/location`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ lat: latitude, lng: longitude, accuracy }),
      });
    } catch (err) {
      // Silently swallow network errors — next interval will retry
    }
  }
);
