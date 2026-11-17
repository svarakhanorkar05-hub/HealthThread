// HealthThread Service Worker for Background Push Notifications
// Provides offline capability & background medication reminder delivery

const SW_VERSION = 'healththread-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for Web Push events from Supabase or server
self.addEventListener('push', (event) => {
  let data = {
    title: 'HealthThread — Medication Reminder',
    body: "It's time to take your scheduled medication.",
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'medication-reminder',
    data: {
      url: '/medications',
      doseId: null,
      medicationId: null,
    },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    tag: data.tag || `med-${Date.now()}`,
    data: data.data || { url: '/medications' },
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      {
        action: 'mark-taken',
        title: '✓ Mark as Taken',
      },
      {
        action: 'snooze',
        title: '⏰ Snooze 15m',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification clicks & action buttons
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/medications';

  // Handle action buttons
  if (action === 'mark-taken') {
    event.waitUntil(
      broadcastOrRecordDoseAction(notifData.doseId, 'taken').then(() => {
        return openAppWindow(targetUrl);
      })
    );
    return;
  }

  if (action === 'snooze') {
    event.waitUntil(
      broadcastOrRecordDoseAction(notifData.doseId, 'snoozed').then(() => {
        // Schedule a follow-up local reminder if needed
      })
    );
    return;
  }

  // Regular click: open/focus HealthThread
  event.waitUntil(openAppWindow(targetUrl));
});

async function openAppWindow(url) {
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    if (client.url.includes(url) && 'focus' in client) {
      return client.focus();
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(url);
  }
}

async function broadcastOrRecordDoseAction(doseId, action) {
  // Inform any open client tabs
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({
      type: 'MEDICATION_ACTION',
      doseId,
      action,
    });
  }
}
