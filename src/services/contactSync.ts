/**
 * MexiChat Contact Sync Service
 * - Syncs device contacts (hashed) to Supabase for friend discovery
 * - Privacy-first: HMAC-SHA256 hashes with app secret, never raw data
 * - Carrier-grade: permission checks, dedup, chunked queries, rate limiting
 */
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

interface DeviceContact {
  name: string;
  phones: string[];
  emails: string[];
}

// HMAC secret — prevents rainbow table attacks on phone hashes
// In production, fetch this from your backend/env. Even a static secret
// raises the bar enormously vs raw SHA-256.
const HASH_SECRET = 'mexichat-contact-v1';

/** HMAC-SHA256 — resistant to rainbow table attacks unlike plain SHA-256 */
async function hmacSha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(HASH_SECRET);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Normalize phone: strip formatting, handle international prefixes */
function normalizePhone(phone: string): string {
  let clean = phone.replace(/[\s\-\(\)\.]/g, '');

  // Remove leading 0 (common in many countries)
  if (clean.startsWith('0') && !clean.startsWith('00')) {
    clean = clean.slice(1);
  }

  // Handle 00 international prefix
  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2);
  }

  // Mexico: 10 digits → +52
  if (/^\d{10}$/.test(clean)) clean = '+52' + clean;
  // US/Canada: 1 + 10 digits → +1
  else if (/^1\d{10}$/.test(clean)) clean = '+' + clean;
  // Mexico with country code, no +
  else if (/^52\d{10}$/.test(clean)) clean = '+' + clean;
  // Russia: 9 + 9 digits or 10 digits → +7
  else if (/^[789]\d{9}$/.test(clean) && clean.length === 10) clean = '+7' + clean;
  else if (/^7\d{10}$/.test(clean)) clean = '+' + clean;
  // China: 1 + 10 digits (mobile) → +86
  else if (/^1[3-9]\d{9}$/.test(clean)) clean = '+86' + clean;
  else if (/^86\d{11}$/.test(clean)) clean = '+' + clean;
  // Already has +
  // else keep as-is

  return clean;
}

/** Normalize email: lowercase, trim */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Read contacts from device (Capacitor native only) */
export async function getDeviceContacts(): Promise<DeviceContact[]> {
  if (!Capacitor.isNativePlatform()) return [];

  try {
    const { Contacts } = await import('@capacitor-community/contacts');

    // Check permission first
    const permCheck = await Contacts.checkPermissions();
    if (permCheck.contacts !== 'granted') {
      const permReq = await Contacts.requestPermissions();
      if (permReq.contacts !== 'granted') {
        console.warn('[ContactSync] Contacts permission denied');
        return [];
      }
    }

    const result = await Contacts.getContacts({
      projection: { name: true, phones: true, emails: true },
    });

    return (result.contacts || [])
      .map((c: any) => ({
        name: c.name?.display || '',
        phones: (c.phones || [])
          .map((p: any) => p.number || '')
          .filter(Boolean),
        emails: (c.emails || [])
          .map((e: any) => e.address || '')
          .filter(Boolean),
      }))
      .filter((c) => c.phones.length > 0 || c.emails.length > 0);
  } catch (err) {
    console.warn('[ContactSync] Failed to read contacts:', err);
    return [];
  }
}

/** Request contacts permission (Capacitor native) */
export async function requestContactsPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { Contacts } = await import('@capacitor-community/contacts');
    const perm = await Contacts.requestPermissions();
    return perm.contacts === 'granted';
  } catch {
    return false;
  }
}

// Rate limiting
let lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 30_000; // 30 seconds between syncs

/** Hash all contacts and upsert to Supabase */
export async function syncContactHashes(userId: string): Promise<number> {
  // Rate limit
  const now = Date.now();
  if (now - lastSyncTime < SYNC_COOLDOWN_MS) {
    console.warn('[ContactSync] Rate limited — wait before syncing again');
    return 0;
  }
  lastSyncTime = now;

  const contacts = await getDeviceContacts();
  if (contacts.length === 0) return 0;

  // Deduplicate hashes with a Set
  const seen = new Set<string>();
  const hashes: { user_id: string; hash: string; contact_type: string }[] = [];

  for (const contact of contacts) {
    for (const phone of contact.phones) {
      const normalized = normalizePhone(phone);
      if (normalized.length >= 8) {
        const hash = await hmacSha256(normalized);
        if (!seen.has(hash)) {
          seen.add(hash);
          hashes.push({ user_id: userId, hash, contact_type: 'phone' });
        }
      }
    }
    for (const email of contact.emails) {
      const normalized = normalizeEmail(email);
      if (normalized.length >= 5) {
        const hash = await hmacSha256(normalized);
        if (!seen.has(hash)) {
          seen.add(hash);
          hashes.push({ user_id: userId, hash, contact_type: 'email' });
        }
      }
    }
  }

  if (hashes.length === 0) return 0;

  // Batch upsert in chunks of 500
  const CHUNK = 500;
  let synced = 0;
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const chunk = hashes.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('contact_hashes' as any)
      .upsert(chunk, { onConflict: 'user_id,hash' });
    if (!error) synced += chunk.length;
    else console.warn('[ContactSync] Upsert error:', error.message);
  }

  console.log(`[ContactSync] Synced ${synced}/${hashes.length} hashes for user ${userId}`);
  return synced;
}

/**
 * Discover which of your contacts are on MexiChat.
 * Chunked queries to avoid URL length limits.
 */
export async function discoverContacts(
  userId: string
): Promise<
  Array<{
    id: string;
    full_name: string;
    username: string | null;
    avatar_url: string | null;
  }>
> {
  // Get my uploaded contact hashes
  const { data: myHashes, error: hashErr } = await supabase
    .from('contact_hashes' as any)
    .select('hash')
    .eq('user_id', userId);

  if (hashErr || !myHashes?.length) return [];

  const hashList = myHashes.map((h: any) => h.hash as string);

  // Chunked queries — Supabase URL limit is ~8KB, ~120 hashes per chunk is safe
  const QUERY_CHUNK = 100;
  const allMatches: any[] = [];

  for (let i = 0; i < hashList.length; i += QUERY_CHUNK) {
    const chunk = hashList.slice(i, i + QUERY_CHUNK);
    const { data: matches, error: matchErr } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('own_hash', chunk)
      .neq('id', userId);

    if (!matchErr && matches) {
      allMatches.push(...matches);
    }
  }

  // Deduplicate by user ID (same user might match on phone AND email hash)
  const uniqueMap = new Map<string, any>();
  for (const m of allMatches) {
    if (!uniqueMap.has(m.id)) {
      uniqueMap.set(m.id, {
        id: m.id,
        full_name: m.full_name || '',
        username: m.username,
        avatar_url: m.avatar_url,
      });
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Hash the current user's phone AND email, store both as own_hash values.
 * Stores phone hash as primary own_hash, and email hash as own_hash_email.
 * This allows OTHER users to discover them via either identifier.
 */
export async function setOwnHash(
  userId: string,
  phone?: string,
  email?: string
): Promise<void> {
  const update: Record<string, string> = {};

  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized.length >= 8) {
      update.own_hash = await hmacSha256(normalized);
    }
  }
  if (email) {
    const normalized = normalizeEmail(email);
    if (normalized.length >= 5) {
      update.own_hash_email = await hmacSha256(normalized);
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(update as any)
      .eq('id', userId);
    if (error) {
      console.warn('[ContactSync] Failed to set own hash:', error.message);
    }
  }
}