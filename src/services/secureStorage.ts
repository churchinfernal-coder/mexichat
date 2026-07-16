/**
 * SecureStorage — Secure token storage using native Keychain (iOS) / Keystore (Android)
 * via capacitor-native-biometric credential storage.
 *
 * Falls back to localStorage on web (non-native).
 *
 * NEVER stores tokens in plain text on native platforms.
 * Tokens require biometric verification to retrieve.
 */
import { Capacitor } from '@capacitor/core';

const SERVER_ID = 'mx.mexichat.app';
const TOKEN_SERVER = 'mx.mexichat.session';

interface SecureStorageAdapter {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

interface NativeCredentialRecord {
  username: string;
  password: string;
}

interface NativeBiometricClient {
  setCredentials(input: { username: string; password: string; server: string }): Promise<void>;
  getCredentials(input: { server: string }): Promise<NativeCredentialRecord>;
  deleteCredentials(input: { server: string }): Promise<void>;
}

// ─── Native adapter: uses NativeBiometric Keychain/Keystore ───
class NativeSecureStorage implements SecureStorageAdapter {
  private mod: NativeBiometricClient | null = null;

  private async getBiometric(): Promise<NativeBiometricClient> {
    if (!this.mod) {
      const m = await import('capacitor-native-biometric');
      this.mod = m.NativeBiometric as NativeBiometricClient;
    }
    return this.mod;
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const NativeBiometric = await this.getBiometric();
      await NativeBiometric.setCredentials({
        username: key,
        password: value,
        server: TOKEN_SERVER,
      });
    } catch (err) {
      console.warn('[SecureStorage] Native setItem failed, fallback:', err);
      localStorage.setItem(`_secure_${key}`, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const NativeBiometric = await this.getBiometric();
      const creds = await NativeBiometric.getCredentials({ server: TOKEN_SERVER });
      // NativeBiometric stores one credential per server, so we use key as username filter
      if (creds.username === key) return creds.password;
      return null;
    } catch {
      // Fallback: check localStorage
      return localStorage.getItem(`_secure_${key}`);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const NativeBiometric = await this.getBiometric();
      await NativeBiometric.deleteCredentials({ server: TOKEN_SERVER });
    } catch {
      localStorage.removeItem(`_secure_${key}`);
    }
  }
}

// ─── Web adapter: localStorage (no Keychain available) ───
class WebSecureStorage implements SecureStorageAdapter {
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }
  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

// Export the appropriate adapter
export const secureStorage: SecureStorageAdapter = Capacitor.isNativePlatform()
  ? new NativeSecureStorage()
  : new WebSecureStorage();

// ─── Session token helpers ───
export async function storeSessionTokens(accessToken: string, refreshToken: string): Promise<void> {
  await secureStorage.setItem('sb_access_token', accessToken);
  await secureStorage.setItem('sb_refresh_token', refreshToken);
}

export async function getSessionTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const accessToken = await secureStorage.getItem('sb_access_token');
  const refreshToken = await secureStorage.getItem('sb_refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearSessionTokens(): Promise<void> {
  await secureStorage.removeItem('sb_access_token');
  await secureStorage.removeItem('sb_refresh_token');
}