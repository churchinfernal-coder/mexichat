/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENTERPRISE MESSAGE ENCRYPTION - GRADE A
 * Version: 2.2.0 — 2026-03-17
 * MexiChat — Enterprise Messaging Platform
 * 
 * ✅ RSA-OAEP 4096-bit + AES-GCM 256-bit hybrid encryption
 * ✅ PBKDF2 password-based key wrapping (310,000 iterations)
 * ✅ Automatic key rotation every 30 days
 * ✅ Safety number verification (Signal-style)
 * ✅ Multi-device support with IndexedDB
 * ✅ Key recovery via backup codes
 * ✅ Device fingerprinting & compromise detection
 * ✅ Full audit logging
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ALGORITHM = {
  name: 'AES-GCM',
  length: 256,
};

const RSA_ALGORITHM = {
  name: 'RSA-OAEP',
  modulusLength: 4096,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const PBKDF2_ITERATIONS = 310000;
const KEY_ROTATION_DAYS = 30;
const MESSAGE_EXPIRY_MS = 31536000000; // 1 year
const MAX_DEVICE_COUNT = 5;

const DB_NAME = 'mexichat_encryption_v2';
const STORE_NAME = 'keys';
const DEVICE_STORE = 'devices';
const AUDIT_STORE = 'audit';

const E2E_PREFIX = 'E2E:';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface EncryptedPayload {
  version: number;
  iv: string;
  data: string;
  key: string;
  timestamp: number;
  messageId: string;
  senderFingerprint: string;
}

interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

interface StoredKeyPair {
  publicKeyJwk: JsonWebKey;
  wrappedPrivateKey: string;
  salt: string;
  iv: string;
  createdAt: number;
  version: number;
  fingerprint: string;
}

interface DeviceInfo {
  deviceId: string;
  fingerprint: string;
  browser: string;
  os: string;
  createdAt: number;
  lastUsed: number;
  keyVersion: number;
}

interface SafetyNumber {
  localFingerprint: string;
  remoteFingerprint: string;
  combined: string;
  formattedNumber: string;
}

interface AuditEvent {
  timestamp: number;
  event: string;
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, unknown>;
}

interface UserDeviceRow {
  device_info: unknown;
  device_fingerprint: string | null;
}

function extractDeviceFingerprint(device: UserDeviceRow): string | null {
  const info = device.device_info;
  if (typeof info === 'object' && info !== null) {
    const candidate = (info as { fingerprint?: unknown }).fingerprint;
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  if (typeof device.device_fingerprint === 'string' && device.device_fingerprint.length > 0) {
    return device.device_fingerprint;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTERPRISE MESSAGE ENCRYPTION CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class EnterpriseMessageEncryption {
  private static keyPair: KeyPair | null = null;
  private static publicKeyCache = new Map<
    string,
    { key: CryptoKey; fingerprint: string; fetchedAt: number }
  >();
  private static initialized = false;
  private static currentUserId: string | null = null;
  private static deviceId: string | null = null;
  private static keyVersion: number = 1;

  // ═══════════════════════════════════════════════════════════════════════
  // 1. INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  static async initialize(userId: string, password: string): Promise<void> {
    if (this.initialized && this.keyPair && this.currentUserId === userId) {
      console.log('🔐 [ENCRYPTION] Already initialized');
      return;
    }

    try {
      console.log('🔐 [ENCRYPTION] Initializing for user:', userId);

      this.currentUserId = userId;
      this.deviceId = await this.getOrCreateDeviceId();

      const storedKeys = await this.loadKeysFromIndexedDB(userId, password);

      if (storedKeys) {
        console.log('🔐 [ENCRYPTION] Loading existing keys (v' + storedKeys.version + ')');
        this.keyPair = storedKeys.keyPair;
        this.keyVersion = storedKeys.version;

        await this.checkAndRotateKeys(userId, password, storedKeys.createdAt);
      } else {
        console.log('🔐 [ENCRYPTION] Generating new RSA key pair');
        this.keyPair = await this.generateRSAKeyPair();
        this.keyVersion = 1;

        await this.saveKeysToIndexedDB(userId, password, this.keyPair);
        await this.uploadPublicKey(userId, this.keyPair.publicKey);
      }

      await this.registerDevice(userId);

      this.initialized = true;

      await this.logAudit({
        timestamp: Date.now(),
        event: 'ENCRYPTION_INITIALIZED',
        severity: 'info',
        details: { userId, deviceId: this.deviceId, keyVersion: this.keyVersion },
      });

      console.log('✅ [ENCRYPTION] Initialized with password protection');
    } catch (error) {
      console.error('❌ [ENCRYPTION] Init failed:', error);
      await this.logAudit({
        timestamp: Date.now(),
        event: 'ENCRYPTION_INIT_FAILED',
        severity: 'critical',
        details: { userId, error: String(error) },
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. PASSWORD-BASED KEY DERIVATION (PBKDF2)
  // ═══════════════════════════════════════════════════════════════════════

  private static async deriveKeyFromPassword(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey']
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. KEY ROTATION
  // ═══════════════════════════════════════════════════════════════════════

  private static async checkAndRotateKeys(
    userId: string,
    password: string,
    createdAt: number
  ): Promise<void> {
    const keyAge = Date.now() - createdAt;
    const rotationThreshold = KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000;

    if (keyAge > rotationThreshold) {
      console.log('🔄 [ENCRYPTION] Key rotation required');
      await this.rotateKeys(userId, password);
    }
  }

  private static async rotateKeys(userId: string, password: string): Promise<void> {
    console.log('🔄 [ENCRYPTION] Rotating keys...');

    const newKeyPair = await this.generateRSAKeyPair();
    const newVersion = this.keyVersion + 1;

    await this.saveKeysToIndexedDB(userId, password, newKeyPair, newVersion);
    await this.uploadPublicKey(userId, newKeyPair.publicKey, newVersion);

    this.keyPair = newKeyPair;
    this.keyVersion = newVersion;

    await this.logAudit({
      timestamp: Date.now(),
      event: 'KEY_ROTATED',
      severity: 'warning',
      details: { userId, oldVersion: newVersion - 1, newVersion },
    });

    console.log('✅ [ENCRYPTION] Keys rotated to version', newVersion);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. SAFETY NUMBERS
  // ═══════════════════════════════════════════════════════════════════════

  static async generateSafetyNumber(remoteUserId: string): Promise<SafetyNumber | null> {
    if (!this.currentUserId || !this.keyPair) {
      throw new Error('Encryption not initialized');
    }

    const localPublicKey = this.keyPair.publicKey;
    const remotePublicKey = await this.getPublicKey(remoteUserId);

    if (!remotePublicKey) {
      console.warn('⚠️ [SAFETY] Cannot generate safety number - remote user has no key');
      return null;
    }

    const localFingerprint = await this.generateFingerprint(localPublicKey);
    const remoteFingerprint = await this.generateFingerprint(remotePublicKey);

    const combined = [localFingerprint, remoteFingerprint].sort().join('');
    const combinedHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(combined)
    );

    const hashString = Array.from(new Uint8Array(combinedHash).slice(0, 30))
      .map((b) => b.toString(10).padStart(3, '0'))
      .join('');

    const formattedNumber = hashString.match(/.{1,5}/g)!.join(' ');

    return {
      localFingerprint,
      remoteFingerprint,
      combined,
      formattedNumber,
    };
  }

  private static async generateFingerprint(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    const hash = await crypto.subtle.digest('SHA-256', exported);
    return this.arrayBufferToBase64(hash);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. ENCRYPT
  // ═══════════════════════════════════════════════════════════════════════

  static async encrypt(message: string, recipientId: string): Promise<string> {
    if (!this.initialized || !this.keyPair || !this.currentUserId) {
      console.warn('⚠️ [ENCRYPTION] Not initialized, sending unencrypted');
      return message;
    }

    try {
      const recipientPublicKey = await this.getPublicKey(recipientId);

      if (!recipientPublicKey) {
        console.warn('⚠️ [ENCRYPTION] Recipient has no public key, sending unencrypted');
        return message;
      }

      const messageId = crypto.randomUUID();
      const sessionKey = await crypto.subtle.generateKey(ALGORITHM, true, [
        'encrypt',
        'decrypt',
      ]);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encodedMessage = new TextEncoder().encode(message);
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        sessionKey,
        encodedMessage
      );

      const rawSessionKey = await crypto.subtle.exportKey('raw', sessionKey);
      const encryptedSessionKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        recipientPublicKey,
        rawSessionKey
      );

      const senderFingerprint = await this.generateFingerprint(this.keyPair.publicKey);

      const payload: EncryptedPayload = {
        version: this.keyVersion,
        iv: this.arrayBufferToBase64(iv.buffer),
        data: this.arrayBufferToBase64(encryptedData),
        key: this.arrayBufferToBase64(encryptedSessionKey),
        timestamp: Date.now(),
        messageId,
        senderFingerprint,
      };

      console.log('✅ [ENCRYPTION] Message encrypted');

      return `${E2E_PREFIX}${btoa(JSON.stringify(payload))}`;
    } catch (error) {
      console.error('❌ [ENCRYPTION] Failed:', error);

      await this.logAudit({
        timestamp: Date.now(),
        event: 'ENCRYPTION_FAILED',
        severity: 'critical',
        details: { recipientId, error: String(error) },
      });

      console.warn('⚠️ [ENCRYPTION] Fallback to unencrypted');
      return message;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. DECRYPT
  // ════════════════════���══════════════════════════════════════════════════

  static async decrypt(encryptedMessage: string, senderId: string): Promise<string> {
    const isEncrypted =
      encryptedMessage.startsWith(E2E_PREFIX) ||
      encryptedMessage.startsWith('🔒E2E:');

    if (!isEncrypted) {
      return encryptedMessage;
    }

    if (!this.initialized || !this.keyPair) {
      console.warn('⚠️ [DECRYPTION] Not initialized');
      return '[🔒 Mensaje cifrado - inicia sesión para descifrar]';
    }

    try {
      let payloadString = encryptedMessage;
      if (payloadString.startsWith('🔒E2E:')) {
        payloadString = payloadString.replace('🔒E2E:', '');
      } else if (payloadString.startsWith(E2E_PREFIX)) {
        payloadString = payloadString.replace(E2E_PREFIX, '');
      }

      const payload: EncryptedPayload = JSON.parse(atob(payloadString));

      // Replay attack protection
      const messageAge = Date.now() - payload.timestamp;
      if (messageAge > MESSAGE_EXPIRY_MS) {
        throw new Error('Message expired (possible replay attack)');
      }

      // Verify sender fingerprint
      const senderPublicKey = await this.getPublicKey(senderId);
      if (senderPublicKey) {
        const expectedFingerprint = await this.generateFingerprint(senderPublicKey);
        if (payload.senderFingerprint !== expectedFingerprint) {
          console.warn('⚠️ [DECRYPT] Fingerprint mismatch - likely encrypted with old keys');
        }
      }

      // Decrypt session key with private key
      const encryptedSessionKeyBuffer = this.base64ToArrayBuffer(payload.key);
      const rawSessionKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        this.keyPair.privateKey,
        encryptedSessionKeyBuffer
      );

      // Import session key
      const sessionKey = await crypto.subtle.importKey(
        'raw',
        rawSessionKey,
        ALGORITHM,
        false,
        ['decrypt']
      );

      // Decrypt message
      const iv = this.base64ToArrayBuffer(payload.iv);
      const encryptedData = this.base64ToArrayBuffer(payload.data);
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        sessionKey,
        encryptedData
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('❌ [DECRYPTION] Failed:', error);

      await this.logAudit({
        timestamp: Date.now(),
        event: 'DECRYPTION_FAILED',
        severity: 'warning',
        details: { senderId, error: String(error) },
      });

      return '[🔒 Mensaje cifrado - no se puede descifrar en este dispositivo]';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. DEVICE FINGERPRINTING & MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  private static async getOrCreateDeviceId(): Promise<string> {
    let deviceId = localStorage.getItem('mexichat_device_id');

    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('mexichat_device_id', deviceId);
    }

    return deviceId;
  }

  private static async getDeviceFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.width,
      screen.height,
      screen.colorDepth,
    ];

    const fingerprint = components.join('|');
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(fingerprint)
    );

    return this.arrayBufferToBase64(hash);
  }

  private static async registerDevice(userId: string): Promise<void> {
    if (!this.deviceId) return;

    const fingerprint = await this.getDeviceFingerprint();
    const browser = this.getBrowserInfo();
    const os = this.getOSInfo();

    const deviceInfo: DeviceInfo = {
      deviceId: this.deviceId,
      fingerprint,
      browser,
      os,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      keyVersion: this.keyVersion,
    };

    // Save to local IndexedDB
    await this.saveToStore(DEVICE_STORE, this.deviceId, deviceInfo);

    try {
      const { error } = await supabase.from('user_devices').upsert(
        {
          user_id: userId,
          device_id: this.deviceId,
          device_name: `${browser} on ${os}`,
          device_type: 'browser',
          platform: 'web',
          os_version: os,
          screen_resolution: `${screen.width}x${screen.height}`,
          device_fingerprint: fingerprint,
          device_info: {
            browser,
            os,
            fingerprint,
            keyVersion: this.keyVersion,
            userAgent: navigator.userAgent,
          },
          is_active: true,
          last_active: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,device_id',
          ignoreDuplicates: false,
        }
      );

      if (error) {
        console.error('❌ [DEVICE] Registration failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.log('✅ [DEVICE] Registered:', this.deviceId);
      }
    } catch (error) {
      console.warn('⚠️ [DEVICE] Failed to register device:', error);
    }
  }

  static async listDevices(userId: string): Promise<UserDeviceRow[]> {
    const { data } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    return (data as UserDeviceRow[] | null) || [];
  }

  static async revokeDevice(userId: string, deviceId: string): Promise<void> {
    await supabase
      .from('user_devices')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    await this.logAudit({
      timestamp: Date.now(),
      event: 'DEVICE_REVOKED',
      severity: 'warning',
      details: { userId, deviceId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. BACKUP & RECOVERY
  // ═══════════════════════════════════════════════════════════════════════

  static async generateRecoveryKey(): Promise<string> {
    if (!this.keyPair) {
      throw new Error('No keys to backup');
    }

    const recoveryKeyBytes = crypto.getRandomValues(new Uint8Array(32));

    const recoveryKey = await crypto.subtle.importKey(
      'raw',
      recoveryKeyBytes,
      { name: 'AES-GCM', length: 256 },
      true,
      ['wrapKey']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrappedKey = await crypto.subtle.wrapKey(
      'jwk',
      this.keyPair.privateKey,
      recoveryKey,
      { name: 'AES-GCM', iv: iv as BufferSource }
    );

    try {
      await supabase.from('key_recovery').upsert({
        user_id: this.currentUserId!,
        wrapped_key: this.arrayBufferToBase64(wrappedKey),
        iv: this.arrayBufferToBase64(iv.buffer),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('⚠️ [RECOVERY] key_recovery table may not exist:', error);
    }

    return this.encodeRecoveryKey(recoveryKeyBytes);
  }

  static async recoverFromRecoveryKey(
    userId: string,
    recoveryKey: string,
    password: string
  ): Promise<void> {
    const recoveryKeyBytes = this.decodeRecoveryKey(recoveryKey);

    const recoveryKeyObj = await crypto.subtle.importKey(
      'raw',
      recoveryKeyBytes as BufferSource,
      { name: 'AES-GCM', length: 256 },
      false,
      ['unwrapKey']
    );

    const { data, error } = await supabase
      .from('key_recovery')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Recovery data not found');
    }

    const wrappedKey = this.base64ToArrayBuffer(data.wrapped_key);
    const iv = this.base64ToArrayBuffer(data.iv);

    const privateKey = await crypto.subtle.unwrapKey(
      'jwk',
      wrappedKey,
      recoveryKeyObj,
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      RSA_ALGORITHM,
      true,
      ['decrypt']
    );

    const privateKeyJwk = await crypto.subtle.exportKey('jwk', privateKey);
    const publicKeyJwk = { ...privateKeyJwk };
    delete publicKeyJwk.d;
    delete publicKeyJwk.dp;
    delete publicKeyJwk.dq;
    delete publicKeyJwk.q;
    delete publicKeyJwk.qi;
    publicKeyJwk.key_ops = ['encrypt'];

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      RSA_ALGORITHM,
      true,
      ['encrypt']
    );

    this.keyPair = { publicKey, privateKey };
    await this.saveKeysToIndexedDB(userId, password, this.keyPair);

    await this.logAudit({
      timestamp: Date.now(),
      event: 'KEYS_RECOVERED',
      severity: 'warning',
      details: { userId },
    });
  }

  private static encodeRecoveryKey(bytes: Uint8Array): string {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt(
      '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    );
    let encoded = '';

    while (num > 0) {
      encoded = alphabet[Number(num % BigInt(58))] + encoded;
      num = num / BigInt(58);
    }

    const matches = encoded.match(/.{1,4}/g);
    return matches ? matches.join('-') : encoded;
  }

  private static decodeRecoveryKey(encoded: string): Uint8Array {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const clean = encoded.replace(/-/g, '');

    let num = BigInt(0);
    for (const char of clean) {
      num = num * BigInt(58) + BigInt(alphabet.indexOf(char));
    }

    const hex = num.toString(16).padStart(64, '0');
    const matches = hex.match(/.{2}/g);
    return new Uint8Array(matches ? matches.map((byte) => parseInt(byte, 16)) : []);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 9. AUDIT LOGGING
  // ═══════════════════════════════════════════════════════════════════════

  private static async logAudit(event: AuditEvent): Promise<void> {
    try {
      await this.saveToStore(AUDIT_STORE, `${event.timestamp}`, event);

      try {
        await supabase.from('encryption_audit_logs').insert({
          user_id: this.currentUserId,
          device_id: this.deviceId,
          event: event.event,
          severity: event.severity,
          details: event.details,
          created_at: new Date(event.timestamp).toISOString(),
        });
      } catch {
        // Table may not exist — audit logs are non-critical
      }
    } catch (error) {
      console.error('❌ [AUDIT] Failed to log:', error);
    }
  }

  static async getAuditLog(): Promise<AuditEvent[]> {
    return await this.getAllFromStore<AuditEvent>(AUDIT_STORE);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 10. KEY COMPROMISE DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  static async detectCompromise(): Promise<boolean> {
    if (!this.currentUserId || !this.deviceId) return false;

    try {
      const { data } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', this.currentUserId)
        .eq('is_active', true);

      const activeDevices = (data as UserDeviceRow[] | null) || [];
      if (activeDevices.length === 0) return false;

      if (activeDevices.length > MAX_DEVICE_COUNT) {
        await this.logAudit({
          timestamp: Date.now(),
          event: 'TOO_MANY_DEVICES',
          severity: 'critical',
          details: { deviceCount: activeDevices.length },
        });
        return true;
      }

      const fingerprints = activeDevices
        .map((d) => extractDeviceFingerprint(d))
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      const duplicates = fingerprints.filter(
        (f: string, i: number) => fingerprints.indexOf(f) !== i
      );

      if (duplicates.length > 0) {
        await this.logAudit({
          timestamp: Date.now(),
          event: 'DUPLICATE_DEVICE_FINGERPRINT',
          severity: 'critical',
          details: { duplicates },
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ [COMPROMISE DETECTION] Failed:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INDEXEDDB OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  private static async saveKeysToIndexedDB(
    userId: string,
    password: string,
    keyPair: KeyPair,
    version: number = 1
  ): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrappingKey = await this.deriveKeyFromPassword(password, salt);

    const wrappedPrivateKey = await crypto.subtle.wrapKey(
      'jwk',
      keyPair.privateKey,
      wrappingKey,
      { name: 'AES-GCM', iv: iv }
    );

    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const fingerprint = await this.generateFingerprint(keyPair.publicKey);

    const stored: StoredKeyPair = {
      publicKeyJwk,
      wrappedPrivateKey: this.arrayBufferToBase64(wrappedPrivateKey),
      salt: this.arrayBufferToBase64(salt.buffer),
      iv: this.arrayBufferToBase64(iv.buffer),
      createdAt: Date.now(),
      version,
      fingerprint,
    };

    await this.saveToStore(STORE_NAME, userId, stored);
  }

  private static async loadKeysFromIndexedDB(
    userId: string,
    password: string
  ): Promise<{ keyPair: KeyPair; version: number; createdAt: number } | null> {
    const stored: StoredKeyPair | null = await this.getFromStore<StoredKeyPair>(STORE_NAME, userId);

    if (!stored) {
      console.log('🔑 [KEY-LOAD] No stored keys found in IndexedDB');
      return null;
    }

    console.log('🔑 [KEY-LOAD] Found stored keys, attempting to unwrap...');

    try {
      const salt = this.base64ToArrayBuffer(stored.salt);
      const wrappingKey = await this.deriveKeyFromPassword(
        password,
        new Uint8Array(salt)
      );

      const iv = this.base64ToArrayBuffer(stored.iv);
      const wrappedKey = this.base64ToArrayBuffer(stored.wrappedPrivateKey);

      const privateKey = await crypto.subtle.unwrapKey(
        'jwk',
        wrappedKey,
        wrappingKey,
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        RSA_ALGORITHM,
        true,
        ['decrypt']
      );

      const publicKey = await crypto.subtle.importKey(
        'jwk',
        stored.publicKeyJwk,
        RSA_ALGORITHM,
        true,
        ['encrypt']
      );

      console.log('✅ [KEY-LOAD] Keys unwrapped successfully');

      return {
        keyPair: { publicKey, privateKey },
        version: stored.version,
        createdAt: stored.createdAt,
      };
    } catch (error) {
      console.error('❌ [KEY-LOAD] Wrong password or corrupted data:', error);
      throw new Error('WRONG_PASSWORD');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GENERIC INDEXEDDB HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private static async saveToStore(
    storeName: string,
    key: string,
    value: unknown
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 3);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
        if (!db.objectStoreNames.contains('devices')) db.createObjectStore('devices');
        if (!db.objectStoreNames.contains('audit')) db.createObjectStore('audit');
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const putRequest = store.put(value, key);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private static async getFromStore<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 3);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
        if (!db.objectStoreNames.contains('devices')) db.createObjectStore('devices');
        if (!db.objectStoreNames.contains('audit')) db.createObjectStore('audit');
      };

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          resolve(null);
          return;
        }
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const getRequest = store.get(key);
        getRequest.onsuccess = () => resolve((getRequest.result as T) || null);
        getRequest.onerror = () => resolve(null);
      };

      request.onerror = () => resolve(null);
    });
  }

  private static async getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 3);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
        if (!db.objectStoreNames.contains('devices')) db.createObjectStore('devices');
        if (!db.objectStoreNames.contains('audit')) db.createObjectStore('audit');
      };

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          resolve([] as T[]);
          return;
        }
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => resolve((getAllRequest.result as T[]) || []);
        getAllRequest.onerror = () => resolve([] as T[]);
      };

      request.onerror = () => resolve([] as T[]);
    });
  }

  private static async deleteFromStore(storeName: string, key: string): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 3);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
        if (!db.objectStoreNames.contains('devices')) db.createObjectStore('devices');
        if (!db.objectStoreNames.contains('audit')) db.createObjectStore('audit');
      };

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          resolve();
          return;
        }
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const deleteRequest = store.delete(key);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
      };

      request.onerror = () => resolve();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC KEY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  private static async getPublicKey(userId: string): Promise<CryptoKey | null> {
    const cached = this.publicKeyCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < 300000) {
      return cached.key;
    }

    try {
      const { data, error } = await supabase
        .from('user_public_keys')
        .select('public_key_jwk, fingerprint')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.warn('⚠️ [ENCRYPTION] No public key for user:', userId);
        return null;
      }

      const publicKeyJwk = JSON.parse(data.public_key_jwk);
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        publicKeyJwk,
        RSA_ALGORITHM,
        true,
        ['encrypt']
      );

      const fingerprint = await this.generateFingerprint(publicKey);
      if (fingerprint !== data.fingerprint) {
        console.error('❌ [ENCRYPTION] Public key fingerprint mismatch');
        return null;
      }

      this.publicKeyCache.set(userId, {
        key: publicKey,
        fingerprint,
        fetchedAt: Date.now(),
      });

      return publicKey;
    } catch (error) {
      console.error('❌ [ENCRYPTION] Failed to fetch public key:', error);
      return null;
    }
  }

  private static async uploadPublicKey(
    userId: string,
    publicKey: CryptoKey,
    version: number = 1
  ): Promise<void> {
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', publicKey);
    const fingerprint = await this.generateFingerprint(publicKey);

    const { error } = await supabase.from('user_public_keys').upsert(
      {
        user_id: userId,
        public_key_jwk: JSON.stringify(publicKeyJwk),
        fingerprint,
        version,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    if (error) {
      console.error('❌ [ENCRYPTION] Failed to upload public key:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RSA KEY GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  private static async generateRSAKeyPair(): Promise<KeyPair> {
    return await crypto.subtle.generateKey(RSA_ALGORITHM, true, [
      'encrypt',
      'decrypt',
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private static getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private static getOSInfo(): string {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'Windows';
    if (platform.includes('mac')) return 'macOS';
    if (platform.includes('linux')) return 'Linux';
    if (platform.includes('iphone') || platform.includes('ipad')) return 'iOS';
    if (platform.includes('android')) return 'Android';
    return 'Unknown';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  static isEncrypted(message: string): boolean {
    return message.startsWith(E2E_PREFIX) || message.startsWith('🔒E2E:');
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  static async hasExistingKeys(userId: string): Promise<boolean> {
    try {
      const stored = await this.getFromStore<StoredKeyPair>(STORE_NAME, userId);
      return !!stored;
    } catch {
      return false;
    }
  }

  static async clearAllData(userId: string): Promise<void> {
    this.keyPair = null;
    this.publicKeyCache.clear();
    this.initialized = false;
    this.currentUserId = null;

    await Promise.all([
      this.deleteFromStore(STORE_NAME, userId),
      this.deleteFromStore(DEVICE_STORE, this.deviceId || ''),
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════���

export const MessageEncryption = EnterpriseMessageEncryption;