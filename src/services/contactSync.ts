/**
 * MexiChat Contact Sync Service
 * - Syncs device contacts (hashed) to Supabase for friend discovery
 * - Privacy-first: only SHA-256 hashes are stored, never raw data
 */
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

interface DeviceContact {
  name: string;
  phones: string[];
  emails: string[];
}

/** SHA-256 hash a string */
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Normalize phone: strip spaces, dashes, parens; ensure +52 for MX numbers */
function normalizePhone(phone: string): string {
  let clean = phone.replace(/[\s\-\(\)\.]/g, '');
  // If starts with 0, remove it
  if (clean.startsWith('0')) clean = clean.slice(1);
  // If 10 digits (Mexican mobile), prepend +52
  if (/^\d{10}$/.test(clean)) clean = '+52' + clean;
  // If starts with 52 but no +, add +
  if (/^52\d{10}$/.test(clean)) clean = '+' + clean;
  return clean;
}

/** Normalize email: lowercase, trim */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Read contacts from device (Capacitor native) */
export async function getDeviceContacts(): Promise<DeviceContact[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const mod = '@capacitor-community/contacts'; const { Contacts } = await import(/* @vite-ignore */ mod);
    const result = await Contacts.getContacts({
      projection: { name: true, phones: true, emails: true },
    });
    return (result.contacts || []).map(c => ({
      name: c.name?.display || '',
      phones: (c.phones || []).map(p => p.number || '').filter(Boolean),
      emails: (c.emails || []).map(e => e.address || '').filter(Boolean),
    })).filter(c => c.phones.length > 0 || c.emails.length > 0);
  } catch (err) {
    console.warn('[ContactSync] Failed to read contacts:', err);
    return [];
  }
}

/** Request contacts permission (Capacitor native) */
export async function requestContactsPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const mod = '@capacitor-community/contacts'; const { Contacts } = await import(/* @vite-ignore */ mod);
    const perm = await Contacts.requestPermissions();
    return perm.contacts === 'granted';
  } catch {
    return false;
  }
}

/** Hash all contacts and upsert to Supabase */
export async function syncContactHashes(userId: string): Promise<number> {
  const contacts = await getDeviceContacts();
  if (contacts.length === 0) return 0;

  const hashes: { user_id: string; hash: string; contact_type: string }[] = [];

  for (const contact of contacts) {
    for (const phone of contact.phones) {
      const normalized = normalizePhone(phone);
      if (normalized.length >= 8) {
        const hash = await sha256(normalized);
        hashes.push({ user_id: userId, hash, contact_type: 'phone' });
      }
    }
    for (const email of contact.emails) {
      const normalized = normalizeEmail(email);
      if (normalized.length >= 5) {
        const hash = await sha256(normalized);
        hashes.push({ user_id: userId, hash, contact_type: 'email' });
      }
    }
  }

  if (hashes.length === 0) return 0;

  // Batch upsert in chunks of 500
  const CHUNK = 500;
  let synced = 0;
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const chunk = hashes.slice(i, i + CHUNK);
    const { error } = await supabase.from('contact_hashes' as any).upsert(chunk, { onConflict: 'user_id,hash' });
    if (!error) synced += chunk.length;
    else console.warn('[ContactSync] Upsert error:', error.message);
  }

  console.log(`[ContactSync] Synced ${synced}/${hashes.length} hashes for user ${userId}`);
  return synced;
}

/**
 * Discover which of your contacts are on MexiChat.
 * Compares your contact hashes against other users' own_hash (their phone/email hash).
 * Returns user IDs + profiles of matched contacts.
 */
export async function discoverContacts(userId: string): Promise<Array<{
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
}>> {
  // Get my uploaded contact hashes
  const { data: myHashes, error: hashErr } = await supabase
    .from('contact_hashes' as any)
    .select('hash')
    .eq('user_id', userId);

  if (hashErr || !myHashes?.length) return [];

  const hashSet = myHashes.map((h: any) => h.hash);

  // Find users whose own_hash matches any of my contact hashes
  // own_hash = SHA-256 of their registered phone or email
  const { data: matches, error: matchErr } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, own_hash')
    .in('own_hash', hashSet)
    .neq('id', userId);

  if (matchErr || !matches) return [];

  return matches.map((m: any) => ({
    id: m.id,
    full_name: m.full_name || '',
    username: m.username,
    avatar_url: m.avatar_url,
  }));
}

/**
 * Hash the current user's phone/email and store as own_hash in profiles.
 * This allows OTHER users to discover them via contact sync.
 */
export async function setOwnHash(userId: string, phone?: string, email?: string): Promise<void> {
  const hashes: string[] = [];

  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized.length >= 8) hashes.push(await sha256(normalized));
  }
  if (email) {
    const normalized = normalizeEmail(email);
    if (normalized.length >= 5) hashes.push(await sha256(normalized));
  }

  if (hashes.length > 0) {
    // Store first hash as own_hash (primary identifier)
    await supabase.from('profiles').update({ own_hash: hashes[0] } as any).eq('id', userId);
  }
}