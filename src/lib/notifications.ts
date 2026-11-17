import { supabase } from '@/lib/supabase';
import type { Medication, MedicationReminderLog, DoseStatus } from '@/types/database';

// Standard application VAPID public key (can be overridden via environment variable)
// Default safe demo public key for browser PushManager subscription
export const DEFAULT_VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

/**
 * Converts a base64 string to a Uint8Array for VAPID applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  endpoint: string | null;
}

/**
 * Checks current browser and device support for Web Push
 */
export async function checkPushSupport(): Promise<PushStatus> {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  if (!isSupported) {
    return {
      isSupported: false,
      permission: 'default',
      isSubscribed: false,
      endpoint: null,
    };
  }

  const permission = Notification.permission;
  let isSubscribed = false;
  let endpoint: string | null = null;

  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        isSubscribed = true;
        endpoint = sub.endpoint;
      }
    }
  } catch (err) {
    console.warn('Error checking push subscription:', err);
  }

  return {
    isSupported,
    permission,
    isSubscribed,
    endpoint,
  };
}

/**
 * Registers the service worker and subscribes the current browser to Web Push
 */
export async function subscribeToPushNotifications(userId: string): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Web Push is not supported in this browser or platform.');
  }

  // Request browser notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied. Please allow notifications in browser settings.');
  }

  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // Subscribe to push manager with VAPID key
  const applicationServerKey = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  // Extract keys
  const rawKey = subscription.getKey('p256dh');
  const rawAuth = subscription.getKey('auth');

  if (!rawKey || !rawAuth) {
    throw new Error('Failed to retrieve push encryption keys from browser.');
  }

  const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))));
  const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

  // Upsert subscription into Supabase push_subscriptions table
  const userAgent = navigator.userAgent;
  const { error: dbError } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id, endpoint' }
  );

  if (dbError) {
    console.error('Error saving push subscription to database:', dbError);
    throw new Error(`Failed to save subscription in database: ${dbError.message}`);
  }

  return subscription;
}

/**
 * Unsubscribes the current device from push notifications
 */
export async function unsubscribeFromPushNotifications(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }
  }
}

/**
 * Sends a test notification to verify device display
 */
export async function sendLocalTestNotification(medicineName = 'Paracetamol', dosage = '500 mg'): Promise<void> {
  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted.');
  }

  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (reg) {
    const options: any = {
      body: `It's time to take your ${medicineName} (${dosage}).`,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: 'test-reminder',
      requireInteraction: true,
      actions: [
        { action: 'mark-taken', title: '✓ Mark as Taken' },
        { action: 'snooze', title: '⏰ Snooze 15m' },
      ],
    };
    await reg.showNotification('HealthThread — Medication Reminder', options);
  } else {
    new Notification('HealthThread — Medication Reminder', {
      body: `It's time to take your ${medicineName} (${dosage}).`,
      icon: '/vite.svg',
    });
  }
}

/**
 * Generates and synchronizes dose logs for today for all active medications
 */
export async function syncTodayDoses(
  userId: string,
  medications: Medication[]
): Promise<MedicationReminderLog[]> {
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = new Date(`${todayStr}T00:00:00.000Z`).toISOString();
  const endOfDay = new Date(`${todayStr}T23:59:59.999Z`).toISOString();

  // Fetch existing logs for today
  const { data: existingLogs, error } = await supabase
    .from('medication_reminder_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_time', startOfDay)
    .lte('scheduled_time', endOfDay);

  if (error) {
    console.error('Error fetching dose logs:', error);
    return [];
  }

  const logs = (existingLogs || []) as MedicationReminderLog[];
  const existingMap = new Map<string, MedicationReminderLog>();
  logs.forEach((l) => {
    existingMap.set(`${l.medication_id}_${l.dose_time}`, l);
  });

  // Check active medications with reminders enabled
  const newDosesToInsert: Array<Record<string, unknown>> = [];

  for (const med of medications) {
    if (!med.active) continue;
    if (med.reminders_enabled === false) continue;

    // Check date bounds
    if (med.start_date && med.start_date > todayStr) continue;
    if (med.end_date && med.end_date < todayStr) continue;

    const times = med.reminder_times && med.reminder_times.length > 0
      ? med.reminder_times
      : ['08:00'];

    for (const time of times) {
      const key = `${med.id}_${time}`;
      if (!existingMap.has(key)) {
        const scheduledTime = new Date(`${todayStr}T${time}:00`).toISOString();
        newDosesToInsert.push({
          user_id: userId,
          medication_id: med.id,
          scheduled_time: scheduledTime,
          dose_time: time,
          status: 'pending',
          notification_sent: false,
        });
      }
    }
  }

  if (newDosesToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('medication_reminder_logs')
      .insert(newDosesToInsert)
      .select();

    if (!insertError && inserted) {
      return [...logs, ...(inserted as MedicationReminderLog[])];
    }
  }

  return logs;
}

/**
 * Updates a dose's status (taken, snoozed, skipped)
 */
export async function updateDoseStatus(
  logId: string,
  status: DoseStatus,
  snoozeMinutes = 15
): Promise<MedicationReminderLog> {
  const now = new Date().toISOString();
  let snoozeUntil: string | null = null;

  if (status === 'snoozed') {
    const snoozeDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    snoozeUntil = snoozeDate.toISOString();
  }

  const { data, error } = await supabase
    .from('medication_reminder_logs')
    .update({
      status,
      action_time: now,
      snooze_until: snoozeUntil,
      updated_at: now,
    })
    .eq('id', logId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update dose: ${error.message}`);
  }

  return data as MedicationReminderLog;
}
