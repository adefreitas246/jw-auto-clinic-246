// tasks/jobTrackingTask.ts
// Background fetch task that polls GET /api/jobs/:id every ~60 seconds.
//
// IMPORTANT: This file MUST be imported at the app root (app/_layout.tsx)
// so that TaskManager.defineTask is called before any component uses it.
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications   from 'expo-notifications';
import * as TaskManager     from 'expo-task-manager';
import AsyncStorage         from '@react-native-async-storage/async-storage';
import axios                from 'axios';

import { JOB_STATUS_LABELS, JobStatus } from '@/types/job';

export const JOB_TRACKING_TASK = 'JOB_TRACKING_TASK';

const ACTIVE_JOB_KEY  = '@washhub/activeJobId';
const LAST_STATUS_KEY = '@washhub/lastJobStatus';

// ─── Register / unregister (called from the tracking screen) ─────────────────

export async function registerJobTracking(
  jobId: string,
  currentStatus: JobStatus
): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_JOB_KEY,  jobId);
  await AsyncStorage.setItem(LAST_STATUS_KEY, currentStatus);

  const fetchStatus = await BackgroundFetch.getStatusAsync();
  if (
    fetchStatus === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    fetchStatus === BackgroundFetch.BackgroundFetchStatus.Denied
  ) return;

  // Avoid double-registering
  const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(JOB_TRACKING_TASK);
  if (alreadyRegistered) return;

  await BackgroundFetch.registerTaskAsync(JOB_TRACKING_TASK, {
    minimumInterval: 60,    // seconds between background polls
    stopOnTerminate: false,
    startOnBoot:     false,
  });
}

export async function unregisterJobTracking(): Promise<void> {
  await AsyncStorage.multiRemove([ACTIVE_JOB_KEY, LAST_STATUS_KEY]);
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(JOB_TRACKING_TASK);
    if (isRegistered) await BackgroundFetch.unregisterTaskAsync(JOB_TRACKING_TASK);
  } catch (_) {}
}

// ─── Task definition ─────────────────────────────────────────────────────────
// Must be defined at module top level (not inside a function/component).

TaskManager.defineTask(JOB_TRACKING_TASK, async () => {
  try {
    const [jobId, lastStatus] = await Promise.all([
      AsyncStorage.getItem(ACTIVE_JOB_KEY),
      AsyncStorage.getItem(LAST_STATUS_KEY),
    ]);

    if (!jobId) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { data: job } = await axios.get(`/api/jobs/${jobId}`);
    const newStatus: JobStatus = job.jobStatus;

    if (newStatus !== lastStatus) {
      await AsyncStorage.setItem(LAST_STATUS_KEY, newStatus);

      const isReady = newStatus === 'finished';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isReady ? '✅ Your vehicle is ready!' : '🚗 Job Update',
          body:  JOB_STATUS_LABELS[newStatus] ?? newStatus,
          data:  { jobId, type: 'job_status_update', jobStatus: newStatus },
          sound: 'default',
        },
        trigger: null, // fire immediately
      });
    }

    // Stop background polling once the job is complete
    if (newStatus === 'finished') {
      await unregisterJobTracking();
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
