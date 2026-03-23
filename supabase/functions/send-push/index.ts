// @ts-nocheck — Deno Edge Function
// Deploy: npx supabase functions deploy send-push --no-verify-jwt

/**
 * MEXICHAT — Web Push Notification Sender v4.0 (Carrier-Grade)
 *
 * Implements:
 *   - RFC 8291: Message Encryption for Web Push
 *   - RFC 8188: Encrypted Content-Encoding (aes128gcm)
 *   - RFC 8292: VAPID (ES256 JWT)
 *   - Full ECDH key agreement + HKDF-SHA256 + AES-128-GCM
 *   - Concurrent delivery to all devices
 *   - Automatic cleanup of expired subscriptions
 *   - Call vs message urgency/TTL differentiation
 *   - Retry with exponential backoff
 *
 * Required Supabase Secrets:
 *   VAPID_PUBLIC_KEY      — 65-byte uncompressed P-256 public key, base64url
 *   VAPID_PRIVATE_KEY     — 32-byte P-256 private key, base64url
 *   VAPID_SUBJECT         — mailto:admin@mexichat.mx
 *   SUPABASE_URL          — https://cchakgecusfybcokbmau.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service_role key from dashboard
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// ═══════════════════════════════════════════════════════════════════════
// ENV
// ═══════════════════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@mexichat.mx';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

// ═══════════════════════════════════════════════════════════════════════
// BASE64URL HELPERS
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// HKDF-SHA256 (RFC 5869)
// ═══════════════════════════════════════════════════════════════════════

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt.length ? salt : new Uint8Array(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  // T(1) = HMAC(PRK, info || 0x01)
  const input = concat(info, new Uint8Array([1]));
  const result = new Uint8Array(await crypto.subtle.sign('HMAC', key, input));
  return result.slice(0, length);
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

// ═══════════════════════════════════════════════════════════════════════
// RFC 8292: VAPID ES256 JWT
// ═══════════════════════════════════════════════════════════════════════

async function createVapidJwt(audience: string): Promise<{ authorization: string }> {
  // JWT Header + Payload
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const unsigned = `${header}.${payload}`;

  // Import VAPID private key as PKCS8
  const privBytes = b64urlDecode(VAPID_PRIVATE_KEY);
  const pubBytes = b64urlDecode(VAPID_PUBLIC_KEY);

  // Build PKCS8 DER wrapper for EC P-256 private key
  // ASN.1: SEQUENCE { version, AlgorithmIdentifier { OID ecPublicKey, OID P-256 }, OCTET STRING { SEQUENCE { version, privateKey, [1] publicKey } } }
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x81, 0x87,                                     // SEQUENCE (135 bytes)
    0x02, 0x01, 0x00,                                     // INTEGER 0 (version)
    0x30, 0x13,                                            // SEQUENCE (19 bytes) — AlgorithmIdentifier
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID 1.2.840.10045.2.1 (ecPublicKey)
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID 1.2.840.10045.3.1.7 (P-256)
    0x04, 0x6d,                                            // OCTET STRING (109 bytes)
    0x30, 0x6b,                                            // SEQUENCE (107 bytes)
    0x02, 0x01, 0x01,                                     // INTEGER 1 (version)
    0x04, 0x20,                                            // OCTET STRING (32 bytes) — private key follows
  ]);
  const pkcs8Suffix = new Uint8Array([
    0xa1, 0x44,                                            // [1] (68 bytes) — public key
    0x03, 0x42, 0x00, 0x04,                               // BIT STRING (66 bytes, 0 unused bits, 0x04 = uncompressed)
  ]);

  // pubBytes is 65 bytes (0x04 || x || y), we need the 64-byte x||y part
  const pubXY = pubBytes.length === 65 ? pubBytes.slice(1) : pubBytes;
  const pkcs8 = concat(pkcs8Prefix, privBytes, pkcs8Suffix, pubXY);

  const signingKey = await crypto.subtle.importKey(
    'pkcs8', pkcs8.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );

  const derSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, new TextEncoder().encode(unsigned)),
  );

  // WebCrypto returns DER-encoded signature, convert to raw r||s (64 bytes)
  let r: Uint8Array, s: Uint8Array;
  if (derSig[0] === 0x30) {
    // Parse DER SEQUENCE { INTEGER r, INTEGER s }
    const rLen = derSig[3];
    const rBytes = derSig.slice(4, 4 + rLen);
    const sOffset = 4 + rLen;
    const sLen = derSig[sOffset + 1];
    const sBytes = derSig.slice(sOffset + 2, sOffset + 2 + sLen);

    // Strip leading zero padding, then left-pad to 32 bytes
    const trimR = rBytes[0] === 0 && rBytes.length > 32 ? rBytes.slice(1) : rBytes;
    const trimS = sBytes[0] === 0 && sBytes.length > 32 ? sBytes.slice(1) : sBytes;
    r = new Uint8Array(32); r.set(trimR, 32 - trimR.length);
    s = new Uint8Array(32); s.set(trimS, 32 - trimS.length);
  } else {
    // Already raw format
    r = derSig.slice(0, 32);
    s = derSig.slice(32, 64);
  }

  const rawSig = concat(r, s);
  const jwt = `${unsigned}.${b64url(rawSig)}`;

  return {
    authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// RFC 8291: Web Push Message Encryption (aes128gcm)
//
// Key derivation:
//   ecdh_secret = ECDH(localPriv, subscriberPub)
//   auth_info   = "WebPush: info\0" || subscriberPub || localPub
//   IKM         = HKDF(ecdh_secret, auth_secret, auth_info, 32)
//   PRK         = HKDF-Extract(salt, IKM)
//   CEK         = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\0", 16)
//   nonce       = HKDF-Expand(PRK, "Content-Encoding: nonce\0", 12)
//
// Encryption:
//   padded    = plaintext || 0x02 || zeros(padding)
//   encrypted = AES-128-GCM(CEK, nonce, padded)
//
// Wire format (aes128gcm):
//   salt(16) || rs(4, big-endian uint32) || idLen(1) || keyId(65) || ciphertext
// ═══════════════════════════════════════════════════════════════════════

async function encryptPayload(
  plaintext: Uint8Array,
  subscriberPubB64: string,
  authSecretB64: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();

  // 1. Decode subscriber keys
  const subscriberPubRaw = b64urlDecode(subscriberPubB64); // 65 bytes (uncompressed)
  const authSecret = b64urlDecode(authSecretB64);          // 16 bytes

  // 2. Import subscriber public key for ECDH
  const subscriberPubKey = await crypto.subtle.importKey(
    'raw', subscriberPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  // 3. Generate ephemeral local key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey)); // 65 bytes

  // 4. ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPubKey }, localKeyPair.privateKey, 256,
  );
  const ecdhSecret = new Uint8Array(sharedBits);

  // 5. Generate 16-byte random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 6. Derive IKM:  HKDF(ecdhSecret, authSecret, "WebPush: info\0" || subscriberPub || localPub, 32)
  const authInfo = concat(enc.encode('WebPush: info\0'), subscriberPubRaw, localPubRaw);
  const ikm = await hkdf(ecdhSecret, authSecret, authInfo, 32);

  // 7. Derive PRK from IKM and salt
  const prk = await hkdfExtract(salt, ikm);

  // 8. Derive CEK (16 bytes) and nonce (12 bytes) from PRK
  const cek = await hkdfExpand(prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, enc.encode('Content-Encoding: nonce\0'), 12);

  // 9. Pad plaintext: payload || 0x02 (delimiter) || zero padding
  //    For payloads < 3993 bytes, no extra padding needed
  const padded = concat(plaintext, new Uint8Array([2]));

  // 10. Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded,
  ));

  // 11. Build aes128gcm wire format
  //     salt(16) || rs(4) || idLen(1) || keyId(localPub, 65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096); // record size

  return concat(salt, rs, new Uint8Array([65]), localPubRaw, ciphertext);
}

// ═══════════════════════════════════════════════════════════════════════
// SEND PUSH WITH RETRY
// ═══════════════════════════════════════════════════════════════════════

interface PushResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  retries?: number;
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: Record<string, unknown>,
  maxRetries = 2,
): Promise<PushResult> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const isCall = payload.type === 'call' || payload.type === 'incoming_call';

  // Encrypt
  let body: Uint8Array;
  try {
    const raw = new TextEncoder().encode(JSON.stringify(payload));
    body = await encryptPayload(raw, sub.p256dh, sub.auth);
  } catch (err) {
    return { success: false, error: `encrypt_failed: ${(err as Error).message}` };
  }

  // VAPID auth
  let authorization: string;
  try {
    const vapid = await createVapidJwt(audience);
    authorization = vapid.authorization;
  } catch (err) {
    return { success: false, error: `vapid_failed: ${(err as Error).message}` };
  }

  // Send with retry
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': isCall ? '30' : '86400',
          'Urgency': isCall ? 'high' : 'normal',
          ...(isCall ? { 'Topic': 'incoming-call' } : {}),
        },
        body,
      });

      // 201 = success, 410/404 = subscription gone
      if (res.status === 201 || res.status === 200) {
        return { success: true, statusCode: res.status, retries: attempt };
      }

      if (res.status === 410 || res.status === 404) {
        return { success: false, statusCode: res.status, error: 'subscription_expired' };
      }

      // 429 = rate limited — retry with backoff
      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      // 500/502/503 = server error — retry
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      const errText = await res.text().catch(() => '');
      return { success: false, statusCode: res.status, error: errText, retries: attempt };
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { success: false, error: `network: ${(err as Error).message}`, retries: attempt };
    }
  }

  return { success: false, error: 'max_retries_exhausted' };
}

// ═══════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      targetUserId, type, title,
      body: messageBody, fromUserId,
      conversationId, callType, avatarUrl,
    } = body;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'targetUserId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all push subscriptions for target user
    const { data: subs, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', targetUserId);

    if (dbErr) {
      console.error('[push] DB error:', dbErr.message);
      return new Response(
        JSON.stringify({ error: 'db_error', detail: dbErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } },
      );
    }

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: 'no_subscriptions' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } },
      );
    }

    // Build push payload
    const isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';
    const pushPayload: Record<string, unknown> = {
      type: type || 'message',
      title: title || 'MexiChat',
      body: messageBody || (isCall ? 'Alguien te está llamando...' : 'Tienes un nuevo mensaje'),
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      tag: isCall ? 'incoming-call' : `msg-${Date.now()}`,
      url: isCall ? `/mensajes?call=${fromUserId || ''}` : '/mensajes',
      fromUserId,
      conversationId,
      callType,
      callerId: fromUserId,
      callerName: title,
      avatarUrl,
      timestamp: Date.now(),
    };

    // Send to all devices concurrently
    const results = await Promise.allSettled(
      subs.map(sub => {
        if (!sub.endpoint || !sub.p256dh || !sub.auth) {
          return Promise.resolve({ success: false, error: 'missing_keys', statusCode: 0 } as PushResult);
        }
        return sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          pushPayload,
        );
      }),
    );

    let sent = 0, failed = 0;
    const expiredIds: string[] = [];
    const errors: string[] = [];

    results.forEach((result, i) => {
      const sub = subs[i];
      if (result.status === 'fulfilled') {
        const r = result.value;
        if (r.success) {
          sent++;
        } else {
          failed++;
          if (r.error === 'subscription_expired') expiredIds.push(sub.id);
          else if (r.error) errors.push(`${sub.endpoint?.slice(0, 40)}: ${r.error}`);
        }
      } else {
        failed++;
        errors.push(`${sub.endpoint?.slice(0, 40)}: ${result.reason}`);
      }
    });

    // Cleanup expired subscriptions
    if (expiredIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[push] target=${targetUserId.slice(0, 8)} type=${type} sent=${sent} failed=${failed} expired=${expiredIds.length} ms=${elapsed}`);
    if (errors.length > 0) console.warn(`[push] errors:`, errors.slice(0, 3));

    return new Response(
      JSON.stringify({ sent, failed, expired: expiredIds.length, ms: elapsed }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } },
    );
  } catch (err) {
    console.error('[push] Fatal:', (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } },
    );
  }
});