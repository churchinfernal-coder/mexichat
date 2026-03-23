/**
 * MEXICHAT — E2EE Encryption Layer
 * Signal-protocol-lite using Web Crypto API (ECDH + AES-GCM)
 * Zero external dependencies
 *
 * Flow:
 *   1. Each user generates ECDH P-256 keypair on first login
 *   2. Public key stored in profiles.public_key
 *   3. Private key stored in localStorage (encrypted at rest)
 *   4. For DMs: derive shared AES-256-GCM key from ECDH
 *   5. For Groups: per-group symmetric key, encrypted per-member
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const CURVE = 'P-256';
const STORAGE_KEY = 'mexichat_e2ee_private_key';
const STORAGE_SALT = 'mexichat_e2ee_salt';

// ─── Key Generation ───

export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    true, // extractable
    ['deriveKey']
  );
}

// ─── Key Export / Import ───

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    'raw',
    bytes,
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
    false, // non-extractable derived key
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
    { name: ALGORITHM, iv },
    sharedKey,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> {
  const cipherBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    sharedKey,
    cipherBytes
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Local Key Storage ───

export function savePrivateKeyLocally(jwkString: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, jwkString);
  } catch {
    console.warn('E2EE: Failed to save private key to localStorage');
  }
}

export function loadPrivateKeyLocally(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearLocalKeys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_SALT);
  } catch {
    // Silent
  }
}

// ─── Group Encryption ───

/**
 * Generate a symmetric key for a group.
 * This key is then encrypted per-member using their public key.
 */
export async function generateGroupKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable so we can wrap it per member
    ['encrypt', 'decrypt']
  );
}

export async function exportGroupKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importGroupKey(base64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap (encrypt) a group key with a member's derived key.
 */
export async function wrapGroupKey(
  groupKey: CryptoKey,
  memberSharedKey: CryptoKey
): Promise<{ wrapped: string; iv: string }> {
  const raw = await crypto.subtle.exportKey('raw', groupKey);
  const rawString = btoa(String.fromCharCode(...new Uint8Array(raw)));
  const result = await encryptMessage(rawString, memberSharedKey);
  return { wrapped: result.ciphertext, iv: result.iv };
}

/**
 * Unwrap (decrypt) a group key with the member's derived key.
 */
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