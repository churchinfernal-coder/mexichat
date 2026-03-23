/**
 * MEXICHAT — Service Worker v4.0 (Production)
 *
 * Handles:
 * 1. Push notifications for messages (when app closed)
 * 2. Push notifications for incoming calls (with 30s vibration + client wake)
 * 3. Notification click → open/focus app
 * 4. Notification actions (Answer/Decline for calls, Open for messages)
 * 5. Offline fallback page
 * 6. Cache-first for static assets
 * 7. Client messaging (INCOMING_CALL, NOTIFICATION_CLICK)
 */

const CACHE_NAME = 'mexichat-v4';
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
];

// ═══════════════════════════════════════════════════════
// INSTALL — Cache offline page + static assets
// ══════════════��════════════════════════════════════════

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        return cache.add(OFFLINE_URL).catch(() => {});
      });
    })
  );
  self.skipWaiting();
});

// ═══════════════════════════════════════════════════════
// ACTIVATE — Clean old caches
// ═══════════════════════════════════════════════════════

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ═══════════════════════════════════════════════════════
// FETCH — Network first, offline fallback
// ═══════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL).then((cached) => {
            return cached || new Response('Offline — No internet connection', {
              status: 503,
              headers: { 'Content-Type': 'text/html' },
            });
          });
        }
        return caches.match(event.request).then((cached) => { return cached || new Response('', { status: 408 }); });
      })
  );
});

// ═══════════════════════════════════════════════════════
// PUSH — Handle push notifications (messages + calls)
//
// Key fixes:
// - Calls get a 30-second vibration pattern
// - Calls wake existing client tabs via postMessage
// - renotify: true ensures notification updates
// ═══════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { title: 'MexiChat', body: event.data ? event.data.text() : 'Nuevo mensaje' };
    } catch {
      data = { title: 'MexiChat', body: 'Nuevo mensaje' };
    }
  }

  const type = data.type || 'message';
  const isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';

  const title = data.title || (isCall ? '📞 Llamada entrante' : 'MexiChat');
  const body = data.body || (isCall ? 'Alguien te está llamando...' : 'Tienes un nuevo mensaje');
  const icon = data.icon || '/web-app-manifest-192x192.png';
  const badge = data.badge || '/favicon-96x96.png';
  const tag = data.tag || (isCall ? 'incoming-call' : 'msg-' + Date.now());
  const url = data.url || data.click_url || '/mensajes';

  // ─── Build notification options ───

  var options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: tag,
    renotify: true,
    requireInteraction: isCall,
    silent: false,
    data: {
      url: url,
      type: type,
      callerId: data.callerId || data.fromUserId || '',
      callerName: data.callerName || data.title || '',
      callType: data.callType || 'audio',
      conversationId: data.conversationId || '',
      avatarUrl: data.avatarUrl || null,
      timestamp: Date.now(),
    },
  };

  // ─── Vibration patterns ───

  if (isCall) {
    // 30-second ringtone vibration: 1s on, 2s off × 10 cycles
    var callPattern = [];
    for (var i = 0; i < 10; i++) {
      callPattern.push(1000); // vibrate 1s
      callPattern.push(2000); // pause 2s
    }
    options.vibrate = callPattern;
    options.actions = [
      { action: 'answer', title: '✅ Contestar' },
      { action: 'decline', title: '❌ Rechazar' },
    ];
  } else {
    options.vibrate = [200, 100, 200];
    options.actions = [
      { action: 'open', title: '💬 Abrir' },
    ];
  }

  // ─── Add image for message notifications if provided ───

  if (data.image && !isCall) {
    options.image = data.image;
  }

  // ─── Show notification + wake client for calls ───

  if (isCall) {
    event.waitUntil(
      self.registration.showNotification(title, options).then(function () {
        // Wake any existing app tabs so they can play the in-app ringtone
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
          var callMessage = {
            type: 'INCOMING_CALL',
            callerId: data.callerId || data.fromUserId || '',
            callerName: data.callerName || data.title || '',
            callType: data.callType || 'audio',
            conversationId: data.conversationId || '',
            avatarUrl: data.avatarUrl || null,
          };
          clients.forEach(function (client) {
            client.postMessage(callMessage);
          });
        });
      })
    );
  } else {
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// ═══════════════════════════════════════════════════════
// NOTIFICATION CLICK — Open/focus app + route correctly
// ═══════════════════════════════════════════════════════

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  var data = event.notification.data || {};
  var action = event.action;
  var type = data.type || 'message';
  var isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';

  // ─── Handle call decline action ───

  if (isCall && action === 'decline') {
    // Notify any open client tabs to reject the call
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({
            type: 'mexichat-reject-call',
            fromUserId: data.callerId,
          });
        });
      })
    );
    return;
  }

  // ─── Determine target URL ───

  var targetUrl = data.url || '/mensajes';
  if (isCall && (action === 'answer' || !action)) {
    // Route to messaging page with call param to auto-answer
    targetUrl = '/mensajes?call=' + encodeURIComponent(data.callerId || '');
  }

  // ─── Focus existing window or open new ───

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      // Try to find and focus an existing window
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          // Send navigation message to the client
          client.postMessage({
            type: isCall ? 'INCOMING_CALL' : 'NOTIFICATION_CLICK',
            url: targetUrl,
            callerId: data.callerId,
            callerName: data.callerName,
            callType: data.callType,
            conversationId: data.conversationId,
            autoAcceptCall: isCall && action === 'answer',
          });
          return client.focus();
        }
      }
      // No existing window — open new one
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ═══════════════════════════════════════════════════════
// NOTIFICATION CLOSE — Handle dismissed call notifications
//
// If user swipes away a call notification without answering,
// treat it as a decline and notify the app.
// ═══════════════════════════════════════════════════════

self.addEventListener('notificationclose', (event) => {
  var data = event.notification.data || {};
  var type = data.type || 'message';
  var isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';

  if (isCall && data.callerId) {
    // User dismissed the call notification — treat as decline
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({
            type: 'mexichat-reject-call',
            fromUserId: data.callerId,
          });
        });
      })
    );
  }
});

// ═══════════════════════════════════════════════════════
// MESSAGE — Receive messages from main thread
// ═══════════════════════════════════════════════════════

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});