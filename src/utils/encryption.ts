/**
 * MEXICHAT — E2EE Encryption Layer (Hardened)
 * Signal-protocol-lite using Web Crypto API (ECDH + AES-GCM)
 * Zero external dependencies
 *
 * Security improvements:
 *   - Private key encrypted at rest via PBKDF2-derived wrapping key
 *   - Safe base64 encoding (no btoa/atob on raw binary)
 *   - Key versioning for cross-device resilience
 *   - Encrypted key backup to Supabase for device sync
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const CURVE = 'P-256';
const STORAGE_KEY = 'mexichat_e2ee_private_key_v2';
const STORAGE_SALT = 'mexichat_e2ee_salt_v2';
const STORAGE_KEY_LEGACY = 'mexichat_e2ee_private_key';
const PBKDF2_ITERATIONS = 310_000;

// ─── Helpers ───

/** Cast Uint8Array to satisfy strict TS DOM BufferSource */
function buf(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

// ─── Safe Base64 ───

export function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Wrapping Key from User ID (PBKDF2) ───

async function deriveWrappingKey(userId: string): Promise<CryptoKey> {
  let saltB64 = localStorage.getItem(STORAGE_SALT);
  let salt: Uint8Array;
  if (saltB64) {
    salt = fromBase64(saltB64);
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(STORAGE_SALT, toBase64(salt));
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    buf(new TextEncoder().encode(userId)),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
  );
}

// ─── Key Generation ───

export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    true,
    ['deriveKey']
  );
}

// ─── Key Export / Import ───

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(raw);
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const bytes = fromBase64(base64);
  return crypto.subtle.importKey(
    'raw',
    buf(bytes),
    { name: 'ECDH', namedCurve: CURVE },
    true,
    []
  );
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: CURVE },
    true,
    ['deriveKey']
  );
}

// ─── Shared Key Derivation ───

export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt / Decrypt ───

export async function encryptMessage(
  plaintext: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: buf(iv) },
    sharedKey,
    buf(encoded)
  );
  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv),
  };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> {
  const cipherBytes = fromBase64(ciphertext);
  const ivBytes = fromBase64(iv);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: buf(ivBytes) },
    sharedKey,
    buf(cipherBytes)
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Encrypted Local Key Storage (AES-GCM wrapped via PBKDF2) ───

export async function savePrivateKeyLocally(jwkString: string, userId: string): Promise<void> {
  try {
    const wrappingKey = await deriveWrappingKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: buf(iv) },
      wrappingKey,
      buf(new TextEncoder().encode(jwkString))
    );
    const payload = JSON.stringify({
      v: 2,
      ct: toBase64(encrypted),
      iv: toBase64(iv),
    });
    localStorage.setItem(STORAGE_KEY, payload);
    try { localStorage.removeItem(STORAGE_KEY_LEGACY); } catch {}
  } catch (err) {
    console.warn('E2EE: Failed to save encrypted private key:', err);
  }
}

export async function loadPrivateKeyLocally(userId: string): Promise<string | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.v === 2 && parsed.ct && parsed.iv) {
        const wrappingKey = await deriveWrappingKey(userId);
        const decrypted = await crypto.subtle.decrypt(
          { name: ALGORITHM, iv: buf(fromBase64(parsed.iv)) },
          wrappingKey,
          buf(fromBase64(parsed.ct))
        );
        return new TextDecoder().decode(decrypted);
      }
    }
    const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacy) {
      await savePrivateKeyLocally(legacy, userId);
      try { localStorage.removeItem(STORAGE_KEY_LEGACY); } catch {}
      return legacy;
    }
    return null;
  } catch (err) {
    console.warn('E2EE: Failed to load private key:', err);
    return null;
  }
}

export function clearLocalKeys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    localStorage.removeItem(STORAGE_SALT);
  } catch {}
}

// ─── Encrypted Cloud Backup ───

export async function createKeyBackup(
  jwkString: string,
  userId: string
): Promise<{ encryptedKey: string; backupIv: string; backupSalt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    buf(new TextEncoder().encode(userId + ':mexichat:backup')),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const backupKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: buf(iv) },
    backupKey,
    buf(new TextEncoder().encode(jwkString))
  );
  return {
    encryptedKey: toBase64(encrypted),
    backupIv: toBase64(iv),
    backupSalt: toBase64(salt),
  };
}

export async function restoreKeyFromBackup(
  encryptedKey: string,
  backupIv: string,
  backupSalt: string,
  userId: string
): Promise<string> {
  const salt = fromBase64(backupSalt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    buf(new TextEncoder().encode(userId + ':mexichat:backup')),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const backupKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: buf(fromBase64(backupIv)) },
    backupKey,
    buf(fromBase64(encryptedKey))
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Group Encryption ───

export async function generateGroupKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportGroupKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(raw);
}

export async function importGroupKey(base64: string): Promise<CryptoKey> {
  const bytes = fromBase64(base64);
  return crypto.subtle.importKey(
    'raw',
    buf(bytes),
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function wrapGroupKey(
  groupKey: CryptoKey,
  memberSharedKey: CryptoKey
): Promise<{ wrapped: string; iv: string }> {
  const raw = await crypto.subtle.exportKey('raw', groupKey);
  const rawString = toBase64(raw);
  const result = await encryptMessage(rawString, memberSharedKey);
  return { wrapped: result.ciphertext, iv: result.iv };
}

export async function unwrapGroupKey(
  wrapped: string,
  iv: string,
  memberSharedKey: CryptoKey
): Promise<CryptoKey> {
  const rawString = await decryptMessage(wrapped, iv, memberSharedKey);
  return importGroupKey(rawString);
}

// ─── Utility ───

export function isE2EESupported(): boolean {
  return !!(
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.generateKey === 'function' &&
    typeof crypto.subtle.deriveKey === 'function'
  );
}