/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Deno Edge Function
// Deploy: npx supabase functions deploy send-push

/**
 * MEXICHAT - Web Push + FCM v1 + APNs Notification Sender v6.0 (Carrier-Grade)
 *
 * Implements:
 *   - RFC 8291: Message Encryption for Web Push
 *   - RFC 8188: Encrypted Content-Encoding (aes128gcm)
 *   - RFC 8292: VAPID (ES256 JWT)
 *   - FCM HTTP v1 API for native Android data messages
 *   - APNs HTTP/2 for native iOS push notifications
 *   - Google Service Account OAuth2 for FCM authentication
 *   - Apple JWT (ES256) for APNs authentication
 *
 * Required Supabase Secrets:
 *   VAPID_PUBLIC_KEY          - 65-byte uncompressed P-256 public key, base64url
 *   VAPID_PRIVATE_KEY         - 32-byte P-256 private key, base64url
 *   VAPID_SUBJECT             - mailto:admin@mexichat.mx
 *   SUPABASE_URL              - project URL
 *   SUPABASE_SERVICE_ROLE_KEY - service_role key
 *   FCM_SERVICE_ACCOUNT       - Google service account JSON (for FCM v1)
 *   FCM_PROJECT_ID            - Firebase project ID
 *   APNS_KEY_ID               - Apple push key ID (from Apple Developer)
 *   APNS_TEAM_ID              - Apple team ID
 *   APNS_AUTH_KEY              - Apple .p8 key contents (-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----)
 *   APNS_BUNDLE_ID            - mx.mexichat.app
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// ========== ENV ==========

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@mexichat.mx';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_SERVICE_ACCOUNT_RAW = Deno.env.get('FCM_SERVICE_ACCOUNT') || '';
const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID') || '';
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') || '';
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') || '';
const APNS_AUTH_KEY = Deno.env.get('APNS_AUTH_KEY') || '';
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || 'mx.mexichat.app';
const PUSH_MAX_SUBSCRIPTIONS = 50;
const PUSH_MAX_TITLE_CHARS = 120;
const PUSH_MAX_BODY_CHARS = 300;
const PUSH_MAX_CALL_TYPE_CHARS = 32;
const PUSH_MAX_AVATAR_URL_CHARS = 500;
const PUSH_RATE_LIMIT_PER_MIN = 60;
const PUSH_IDEMPOTENCY_TTL_SECONDS = 120;
const PUSH_ALLOWED_ORIGINS = (Deno.env.get('PUSH_ALLOWED_ORIGINS') || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOWED_PUSH_TYPES = new Set(['message', 'call', 'incoming_call', 'video_call']);
const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9:_-]{16,128}$/;

const CORS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, x-idempotency-key',
  'Vary': 'Origin',
};

function resolveCorsHeaders(req: Request): Record<string, string> | null {
  const origin = (req.headers.get('origin') || '').trim();
  if (PUSH_ALLOWED_ORIGINS.length === 0) {
    return { ...CORS, 'Access-Control-Allow-Origin': '*' };
  }

  if (origin && PUSH_ALLOWED_ORIGINS.includes(origin)) {
    return { ...CORS, 'Access-Control-Allow-Origin': origin };
  }

  if (!origin) {
    return { ...CORS, 'Access-Control-Allow-Origin': PUSH_ALLOWED_ORIGINS[0] };
  }

  return null;
}

function jsonResponse(payload: Record<string, unknown>, status = 200, corsHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...(corsHeaders || CORS) },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function clampString(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || '';
  const first = forwarded.split(',')[0]?.trim();
  return (first || 'unknown').slice(0, 64);
}

function isValidIdempotencyKey(value: string): boolean {
  return IDEMPOTENCY_KEY_PATTERN.test(value);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ========== BASE64URL HELPERS ==========

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// ========== HKDF-SHA256 ==========

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt.length ? salt : new Uint8Array(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const input = concat(info, new Uint8Array([1]));
  const result = new Uint8Array(await crypto.subtle.sign('HMAC', key, input));
  return result.slice(0, length);
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

// ========== VAPID ES256 JWT ==========

async function createVapidJwt(audience: string): Promise<{ authorization: string }> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT,
  })));
  const unsigned = `${header}.${payload}`;
  const privBytes = b64urlDecode(VAPID_PRIVATE_KEY);
  const pubBytes = b64urlDecode(VAPID_PUBLIC_KEY);
  const pkcs8Prefix = new Uint8Array([0x30,0x81,0x87,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x6d,0x30,0x6b,0x02,0x01,0x01,0x04,0x20]);
  const pkcs8Suffix = new Uint8Array([0xa1,0x44,0x03,0x42,0x00,0x04]);
  const pubXY = pubBytes.length === 65 ? pubBytes.slice(1) : pubBytes;
  const pkcs8 = concat(pkcs8Prefix, privBytes, pkcs8Suffix, pubXY);
  const signingKey = await crypto.subtle.importKey('pkcs8', pkcs8.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const derSig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, new TextEncoder().encode(unsigned)));
  let r: Uint8Array, s: Uint8Array;
  if (derSig[0] === 0x30) {
    const rLen = derSig[3]; const rBytes = derSig.slice(4, 4 + rLen);
    const sOffset = 4 + rLen; const sLen = derSig[sOffset + 1]; const sBytes = derSig.slice(sOffset + 2, sOffset + 2 + sLen);
    const trimR = rBytes[0] === 0 && rBytes.length > 32 ? rBytes.slice(1) : rBytes;
    const trimS = sBytes[0] === 0 && sBytes.length > 32 ? sBytes.slice(1) : sBytes;
    r = new Uint8Array(32); r.set(trimR, 32 - trimR.length);
    s = new Uint8Array(32); s.set(trimS, 32 - trimS.length);
  } else { r = derSig.slice(0, 32); s = derSig.slice(32, 64); }
  const jwt = `${unsigned}.${b64url(concat(r, s))}`;
  return { authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}` };
}

// ========== WEB PUSH ENCRYPTION ==========

async function encryptPayload(plaintext: Uint8Array, subscriberPubB64: string, authSecretB64: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const subscriberPubRaw = b64urlDecode(subscriberPubB64);
  const authSecret = b64urlDecode(authSecretB64);
  const subscriberPubKey = await crypto.subtle.importKey('raw', subscriberPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberPubKey }, localKeyPair.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = concat(enc.encode('WebPush: info\0'), subscriberPubRaw, localPubRaw);
  const ikm = await hkdf(ecdhSecret, authSecret, authInfo, 32);
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const padded = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([65]), localPubRaw, ciphertext);
}

// ========== FCM v1 API ==========

let _fcmAccessToken: string | null = null;
let _fcmTokenExpiry = 0;

async function getFcmAccessToken(): Promise<string | null> {
  if (!FCM_SERVICE_ACCOUNT_RAW) return null;
  if (_fcmAccessToken && Date.now() < _fcmTokenExpiry - 300000) return _fcmAccessToken;
  try {
    const sa = JSON.parse(FCM_SERVICE_ACCOUNT_RAW);
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const jwtClaim = b64url(new TextEncoder().encode(JSON.stringify({
      iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    })));
    const pemBody = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s/g,'');
    const keyBuf = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const rsaKey = await crypto.subtle.importKey('pkcs8', keyBuf.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsaKey, new TextEncoder().encode(`${jwtHeader}.${jwtClaim}`)));
    const signedJwt = `${jwtHeader}.${jwtClaim}.${b64url(sig)}`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`,
    });
    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    _fcmAccessToken = tokenData.access_token;
    _fcmTokenExpiry = Date.now() + (tokenData.expires_in || 3600) * 1000;
    return _fcmAccessToken;
  } catch (err) { console.error('[FCM] OAuth2 error:', (err as Error).message); return null; }
}

async function sendFcmDataMessage(fcmToken: string, data: Record<string, string>, isCall: boolean): Promise<{ success: boolean; error?: string }> {
  if (!FCM_PROJECT_ID) return { success: false, error: 'FCM_PROJECT_ID not set' };
  const accessToken = await getFcmAccessToken();
  if (!accessToken) return { success: false, error: 'FCM OAuth2 failed' };
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: fcmToken, data, android: { priority: isCall ? 'HIGH' : 'NORMAL', ttl: isCall ? '30s' : '86400s' } } }),
    });
    if (res.ok) return { success: true };
    const errText = await res.text().catch(() => '');
    if (res.status === 404 || res.status === 410 || errText.includes('UNREGISTERED')) return { success: false, error: 'token_expired' };
    return { success: false, error: `fcm_${res.status}` };
  } catch (err) { return { success: false, error: `fcm_network: ${(err as Error).message}` }; }
}

// ========== APNs HTTP/2 (Apple Push Notification service) ==========

let _apnsJwt: string | null = null;
let _apnsJwtExpiry = 0;

async function getApnsJwt(): Promise<string | null> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_AUTH_KEY) return null;
  if (_apnsJwt && Date.now() < _apnsJwtExpiry - 300000) return _apnsJwt;
  try {
    const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID })));
    const now = Math.floor(Date.now() / 1000);
    const claims = b64url(new TextEncoder().encode(JSON.stringify({ iss: APNS_TEAM_ID, iat: now })));
    const unsigned = `${header}.${claims}`;
    const pemBody = APNS_AUTH_KEY.replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s/g,'');
    const keyBuf = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const ecKey = await crypto.subtle.importKey('pkcs8', keyBuf.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const derSig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, ecKey, new TextEncoder().encode(unsigned)));
    let r: Uint8Array, s: Uint8Array;
    if (derSig[0] === 0x30) {
      const rLen = derSig[3]; const rBytes = derSig.slice(4, 4 + rLen);
      const sOffset = 4 + rLen; const sLen = derSig[sOffset + 1]; const sBytes = derSig.slice(sOffset + 2, sOffset + 2 + sLen);
      const trimR = rBytes[0] === 0 && rBytes.length > 32 ? rBytes.slice(1) : rBytes;
      const trimS = sBytes[0] === 0 && sBytes.length > 32 ? sBytes.slice(1) : sBytes;
      r = new Uint8Array(32); r.set(trimR, 32 - trimR.length);
      s = new Uint8Array(32); s.set(trimS, 32 - trimS.length);
    } else { r = derSig.slice(0, 32); s = derSig.slice(32, 64); }
    _apnsJwt = `${unsigned}.${b64url(concat(r, s))}`;
    _apnsJwtExpiry = Date.now() + 50 * 60 * 1000; // 50 minutes
    return _apnsJwt;
  } catch (err) { console.error('[APNs] JWT error:', (err as Error).message); return null; }
}

async function sendApns(deviceToken: string, payload: Record<string, unknown>, isCall: boolean): Promise<{ success: boolean; error?: string }> {
  const jwt = await getApnsJwt();
  if (!jwt) return { success: false, error: 'apns_jwt_failed' };
  const apnsHost = 'https://api.push.apple.com';
  const apnsPayload = {
    aps: {
      alert: { title: payload.title || 'MexiChat', body: payload.body || 'Nuevo mensaje' },
      sound: isCall ? 'ringtone.caf' : 'default',
      badge: 1,
      'mutable-content': 1,
      'content-available': 1,
      category: isCall ? 'INCOMING_CALL' : undefined,
    },
    // Custom data (accessible in notification handlers)
    type: payload.type || 'message',
    fromUserId: payload.fromUserId || '',
    conversationId: payload.conversationId || '',
    callType: payload.callType || '',
    callerId: payload.callerId || payload.fromUserId || '',
    callerName: payload.callerName || payload.title || '',
    avatarUrl: payload.avatarUrl || '',
  };
  try {
    const res = await fetch(`${apnsHost}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': APNS_BUNDLE_ID,
        'apns-push-type': isCall ? 'alert' : 'alert',
        'apns-priority': isCall ? '10' : '5',
        'apns-expiration': isCall ? '30' : '86400',
      },
      body: JSON.stringify(apnsPayload),
    });
    if (res.status === 200) return { success: true };
    const errBody = await res.text().catch(() => '');
    if (res.status === 410 || errBody.includes('Unregistered') || errBody.includes('BadDeviceToken')) {
      return { success: false, error: 'token_expired' };
    }
    return { success: false, error: `apns_${res.status}: ${errBody.slice(0, 100)}` };
  } catch (err) { return { success: false, error: `apns_network: ${(err as Error).message}` }; }
}

// ========== WEB PUSH ==========

async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: Record<string, unknown>, maxRetries = 2): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const isCall = payload.type === 'call' || payload.type === 'incoming_call';
  let body: Uint8Array;
  try { body = await encryptPayload(new TextEncoder().encode(JSON.stringify(payload)), sub.p256dh, sub.auth); }
  catch (err) { return { success: false, error: `encrypt_failed` }; }
  let authorization: string;
  try { authorization = (await createVapidJwt(audience)).authorization; }
  catch (err) { return { success: false, error: `vapid_failed` }; }
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(sub.endpoint, {
        method: 'POST', headers: {
          'Authorization': authorization, 'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm', 'TTL': isCall ? '30' : '86400',
          'Urgency': isCall ? 'high' : 'normal', ...(isCall ? { 'Topic': 'incoming-call' } : {}),
        }, body,
      });
      if (res.status === 201 || res.status === 200) return { success: true, statusCode: res.status };
      if (res.status === 410 || res.status === 404) return { success: false, statusCode: res.status, error: 'subscription_expired' };
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
      return { success: false, statusCode: res.status };
    } catch (err) { if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; } return { success: false, error: `network` }; }
  }
  return { success: false, error: 'max_retries' };
}

// ========== HANDLER ==========

serve(async (req: Request) => {
  const corsHeaders = resolveCorsHeaders(req);
  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse({ error: 'invalid_content_type', requestId }, 415, corsHeaders);
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!jwt) {
      return jsonResponse({ error: 'unauthorized', requestId }, 401, corsHeaders);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'invalid_json', requestId }, 400, corsHeaders);
    }

    const targetUserId = body.targetUserId;
    const type = clampString(body.type, 24, 'message');
    const title = clampString(body.title, PUSH_MAX_TITLE_CHARS, 'MexiChat');
    const messageBody = clampString(body.body, PUSH_MAX_BODY_CHARS, 'Tienes un nuevo mensaje');
    const fromUserId = body.fromUserId;
    const conversationId = body.conversationId;
    const callType = clampString(body.callType, PUSH_MAX_CALL_TYPE_CHARS, '');
    const avatarUrl = clampString(body.avatarUrl, PUSH_MAX_AVATAR_URL_CHARS, '');
    const idempotencyKey = (req.headers.get('x-idempotency-key') || '').trim();

    if (!isUuid(targetUserId)) {
      return jsonResponse({ error: 'targetUserId must be uuid', requestId }, 400, corsHeaders);
    }

    if (!ALLOWED_PUSH_TYPES.has(type)) {
      return jsonResponse({ error: 'invalid_type', requestId }, 400, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    const callerUserId = authData?.user?.id;
    if (authError || !callerUserId) {
      return jsonResponse({ error: 'invalid_token', requestId }, 401, corsHeaders);
    }

    const clientIp = getClientIp(req);

    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc('fn_check_push_rate_limit', {
      p_actor_user_id: callerUserId,
      p_source_ip: clientIp,
      p_limit: PUSH_RATE_LIMIT_PER_MIN,
    });

    if (rateLimitError) {
      return jsonResponse({ error: 'rate_limit_check_failed', requestId }, 500, corsHeaders);
    }

    if (!rateLimitData?.allowed) {
      return jsonResponse({
        error: 'rate_limited',
        requestId,
        limit: rateLimitData?.limit ?? PUSH_RATE_LIMIT_PER_MIN,
        count: rateLimitData?.count ?? null,
      }, 429, corsHeaders);
    }

    const eventType = String(type || 'message');
    const requiresActor = eventType === 'message' || eventType === 'call' || eventType === 'incoming_call' || eventType === 'video_call';
    if (requiresActor) {
      if (!isValidIdempotencyKey(idempotencyKey)) {
        return jsonResponse({ error: 'invalid_idempotency_key', requestId }, 400, corsHeaders);
      }

      const requestHashInput = JSON.stringify({
        type,
        title,
        messageBody,
        targetUserId,
        fromUserId,
        conversationId,
        callType,
        avatarUrl,
      });
      const requestHash = await sha256Hex(requestHashInput);

      const { data: idempotencyData, error: idempotencyError } = await supabase.rpc('fn_register_push_idempotency', {
        p_actor_user_id: callerUserId,
        p_idempotency_key: idempotencyKey,
        p_ttl_seconds: PUSH_IDEMPOTENCY_TTL_SECONDS,
        p_request_hash: requestHash,
      });

      if (idempotencyError) {
        return jsonResponse({ error: 'idempotency_check_failed', requestId }, 500, corsHeaders);
      }

      if (!idempotencyData?.accepted) {
        const reason = idempotencyData?.reason === 'idempotency_key_payload_mismatch'
          ? 'idempotency_key_payload_mismatch'
          : 'replay_detected';
        return jsonResponse({ error: reason, requestId }, 409, corsHeaders);
      }

      if (!isUuid(fromUserId)) {
        return jsonResponse({ error: 'fromUserId required', requestId }, 400, corsHeaders);
      }

      if (fromUserId !== callerUserId) {
        return jsonResponse({ error: 'forbidden_sender_mismatch', requestId }, 403, corsHeaders);
      }

      if (conversationId != null) {
        if (!isUuid(conversationId)) {
          return jsonResponse({ error: 'invalid_conversation_id', requestId }, 400, corsHeaders);
        }

        const { data: convo, error: convoErr } = await supabase
          .from('conversations')
          .select('id, user_1, user_2')
          .eq('id', conversationId)
          .maybeSingle();

        if (convoErr) {
          return jsonResponse({ error: 'conversation_lookup_failed', requestId }, 500, corsHeaders);
        }

        if (!convo) {
          return jsonResponse({ error: 'conversation_not_found', requestId }, 404, corsHeaders);
        }

        const isCallerParticipant = convo.user_1 === callerUserId || convo.user_2 === callerUserId;
        const isTargetParticipant = convo.user_1 === targetUserId || convo.user_2 === targetUserId;
        if (!isCallerParticipant || !isTargetParticipant) {
          return jsonResponse({ error: 'forbidden_conversation_mismatch', requestId }, 403, corsHeaders);
        }
      }
    }

    const { data: subs, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', targetUserId)
      .limit(PUSH_MAX_SUBSCRIPTIONS);
    if (dbErr) return jsonResponse({ error: 'db_error', requestId }, 500, corsHeaders);
    if (!subs || subs.length === 0) return jsonResponse({ sent: 0, reason: 'no_subscriptions', requestId }, 200, corsHeaders);

    const isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';
    const pushPayload: Record<string, unknown> = {
      type: type || 'message', title: title || 'MexiChat',
      body: messageBody || (isCall ? 'Alguien te esta llamando...' : 'Tienes un nuevo mensaje'),
      icon: '/web-app-manifest-192x192.png', badge: '/favicon-96x96.png',
      tag: isCall ? 'incoming-call' : `msg-${Date.now()}`, url: isCall ? `/mensajes?call=${fromUserId || ''}` : '/mensajes',
      fromUserId, conversationId, callType, callerId: fromUserId, callerName: title, avatarUrl, timestamp: Date.now(),
    };

    const webSubs: typeof subs = [];
    const androidTokens: { id: string; token: string }[] = [];
    const iosTokens: { id: string; token: string }[] = [];

    for (const sub of subs) {
      if (sub.endpoint?.startsWith('native:android:')) {
        androidTokens.push({ id: sub.id, token: sub.auth || sub.endpoint.replace('native:android:', '') });
      } else if (sub.endpoint?.startsWith('native:ios:')) {
        iosTokens.push({ id: sub.id, token: sub.auth || sub.endpoint.replace('native:ios:', '') });
      } else if (sub.endpoint && sub.p256dh && sub.auth) {
        webSubs.push(sub);
      }
    }

    let sent = 0, failed = 0;
    const expiredIds: string[] = [];

    // Web Push
    if (webSubs.length > 0) {
      const results = await Promise.allSettled(webSubs.map(sub => sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, pushPayload)));
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.success) sent++;
        else { failed++; if (r.status === 'fulfilled' && r.value.error === 'subscription_expired') expiredIds.push(webSubs[i].id); }
      });
    }

    // Android FCM
    if (androidTokens.length > 0) {
      const fcmData: Record<string, string> = {
        type: String(type || 'message'), title: String(title || 'MexiChat'),
        body: String(messageBody || ''), fromUserId: String(fromUserId || ''),
        conversationId: String(conversationId || ''), callType: String(callType || ''),
        callerId: String(fromUserId || ''), callerName: String(title || ''),
        avatarUrl: String(avatarUrl || ''), timestamp: String(Date.now()),
      };
      const results = await Promise.allSettled(androidTokens.map(nt => sendFcmDataMessage(nt.token, fcmData, isCall)));
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.success) sent++;
        else { failed++; if (r.status === 'fulfilled' && r.value.error === 'token_expired') expiredIds.push(androidTokens[i].id); }
      });
    }

    // iOS APNs
    if (iosTokens.length > 0) {
      const results = await Promise.allSettled(iosTokens.map(nt => sendApns(nt.token, pushPayload, isCall)));
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.success) sent++;
        else { failed++; if (r.status === 'fulfilled' && r.value.error === 'token_expired') expiredIds.push(iosTokens[i].id); }
      });
    }

    // Cleanup expired
    if (expiredIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', expiredIds);

    const elapsed = Date.now() - startTime;
    console.log(`[push] request=${requestId} ip=${clientIp} target=${targetUserId.slice(0,8)} type=${type} web=${webSubs.length} fcm=${androidTokens.length} apns=${iosTokens.length} sent=${sent} failed=${failed} ms=${elapsed}`);

    return jsonResponse({ sent, failed, expired: expiredIds.length, web: webSubs.length, fcm: androidTokens.length, apns: iosTokens.length, ms: elapsed, requestId }, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message, requestId }, 500, corsHeaders);
  }
});