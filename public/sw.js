/**
 * MEXICHAT Service Worker v2 — Push + Offline
 */

const CACHE_NAME = 'mexichat-v1';
const OFFLINE_URL = '/offline.html';

// Install — cache offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — offline fallback for navigation
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// Push — handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try { data = { title: 'MexiChat', body: event.data.text() }; } catch (e2) {}
  }

  const type = data.type || 'message';
  const isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';

  const title = data.title || 'MexiChat';
  const options = {
    body: data.body || (isCall ? 'Llamada entrante...' : 'Nuevo mensaje'),
    icon: data.icon || '/web-app-manifest-192x192.png',
    badge: data.badge || '/favicon-96x96.png',
    tag: data.tag || (isCall ? 'incoming-call' : 'msg-' + Date.now()),
    renotify: true,
    requireInteraction: isCall,
    silent: false,
    vibrate: isCall ? [1000, 500, 1000, 500, 1000] : [200, 100, 200],
    data: {
      url: data.url || '/mensajes',
      type: type,
      conversationId: data.conversationId || '',
      fromUserId: data.fromUserId || '',
      callerId: data.callerId || data.fromUserId || '',
      callerName: data.callerName || title,
      callType: data.callType || 'audio',
      autoAcceptCall: false,
    },
  };

  if (isCall) {
    options.actions = [
      { action: 'answer', title: 'Contestar' },
      { action: 'reject', title: 'Rechazar' },
    ];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;

  notification.close();

  if (action === 'reject') {
    // Tell the app to reject the call
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'mexichat-reject-call',
            fromUserId: data.callerId || data.fromUserId,
          });
        });
      })
    );
    return;
  }

  const autoAccept = action === 'answer';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it and send message
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            conversationId: data.conversationId,
            fromUserId: data.fromUserId,
            callerId: data.callerId,
            callerName: data.callerName,
            callType: data.callType,
            autoAcceptCall: autoAccept,
          });
          return;
        }
      }

      // No open window — open the app
      const url = data.conversationId
        ? '/mensajes?c=' + data.conversationId
        : data.url || '/mensajes';

      return self.clients.openWindow(url).then((newClient) => {
        if (newClient) {
          // Small delay to let the app initialize
          setTimeout(() => {
            newClient.postMessage({
              type: 'NOTIFICATION_CLICK',
              conversationId: data.conversationId,
              fromUserId: data.fromUserId,
              callerId: data.callerId,
              callerName: data.callerName,
              callType: data.callType,
              autoAcceptCall: autoAccept,
            });
          }, 2000);
        }
      });
    })
  );
});

// Notification close (user dismissed)
self.addEventListener('notificationclose', (event) => {
  // No action needed — just log
});