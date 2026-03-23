/**
 * Biometric Authentication Service — MexiChat
 *
 * Covers ALL requirements:
 * - iOS: Face ID / Touch ID via LocalAuthentication (through Capacitor NativeBiometric)
 * - Android: BiometricPrompt API (fingerprint, face, iris)
 * - Web: Falls back to PIN/password (no hardware biometric on web)
 *
 * Integration points:
 * - App launch gate
 * - Payment confirmation (Mercado Pago / OXXO)
 * - Inactivity re-authentication
 * - Sensitive chat access
 *
 * Privacy: NO biometric data leaves the device. Only a boolean pass/fail.
 */
import { Capacitor } from '@capacitor/core';

// ─── Types ───
export type BiometryType = 'fingerprint' | 'face' | 'iris' | 'none';

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: BiometryType;
  isEnrolled: boolean;
}

export interface BiometricConfig {
  enabled: boolean;
  requireForAppOpen: boolean;
  requireForPayments: boolean;
  requireForSensitiveChats: boolean;
  inactivityTimeoutMinutes: number; // 0 = disabled
}

const CONFIG_KEY = 'mc_biometric_config';
const LAST_ACTIVITY_KEY = 'mc_last_activity';

// ─── Default config ───
const DEFAULT_CONFIG: BiometricConfig = {
  enabled: false,
  requireForAppOpen: true,
  requireForPayments: true,
  requireForSensitiveChats: false,
  inactivityTimeoutMinutes: 5,
};

// ─── Config persistence ───
export function getBiometricConfig(): BiometricConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveBiometricConfig(config: Partial<BiometricConfig>): BiometricConfig {
  const current = getBiometricConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

// ─── Activity tracking (for inactivity timeout) ───
export function recordActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

export function isInactivityExpired(): boolean {
  const config = getBiometricConfig();
  if (!config.enabled || config.inactivityTimeoutMinutes <= 0) return false;

  const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
  if (!last) return true;

  const elapsed = (Date.now() - last) / 1000 / 60; // minutes
  return elapsed >= config.inactivityTimeoutMinutes;
}

// ─── Check device biometric capability ───
export async function checkBiometrics(): Promise<BiometricStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { isAvailable: false, biometryType: 'none', isEnrolled: false };
  }
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    const types: Record<number, BiometryType> = { 1: 'fingerprint', 2: 'face', 3: 'iris' };
    return {
      isAvailable: result.isAvailable,
      biometryType: types[result.biometryType] || 'fingerprint',
      isEnrolled: result.isAvailable, // If available, device has enrolled biometrics
    };
  } catch {
    return { isAvailable: false, biometryType: 'none', isEnrolled: false };
  }
}

// ─── Prompt biometric verification ───
export async function verifyBiometric(
  reason = 'Verifica tu identidad',
  options?: { title?: string; subtitle?: string }
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason,
      title: options?.title || 'MexiChat',
      subtitle: options?.subtitle || 'Autenticacion biometrica',
      description: reason,
      useFallback: true,  // Allow device passcode as fallback
      maxAttempts: 3,
    });
    recordActivity();
    return true;
  } catch {
    return false;
  }
}

// ─── Specific verification contexts ───

export async function verifyForAppOpen(): Promise<boolean> {
  const config = getBiometricConfig();
  if (!config.enabled || !config.requireForAppOpen) return true;

  const status = await checkBiometrics();
  if (!status.isAvailable) return true; // No biometrics = skip (PIN fallback handles it)

  return verifyBiometric('Desbloquea MexiChat', {
    title: 'MexiChat',
    subtitle: 'Verificacion al abrir la app',
  });
}

export async function verifyForPayment(amount?: number): Promise<boolean> {
  const config = getBiometricConfig();
  if (!config.enabled || !config.requireForPayments) return true;

  const status = await checkBiometrics();
  if (!status.isAvailable) return true;

  const desc = amount ? `Confirma pago de $${amount.toFixed(2)} MXN` : 'Confirma tu pago';
  return verifyBiometric(desc, {
    title: 'Confirmar Pago',
    subtitle: 'MexiChat Pagos',
  });
}

export async function verifyForInactivity(): Promise<boolean> {
  if (!isInactivityExpired()) return true;

  const config = getBiometricConfig();
  if (!config.enabled) return true;

  const status = await checkBiometrics();
  if (!status.isAvailable) return true;

  return verifyBiometric('Sesion inactiva — verifica tu identidad', {
    title: 'Sesion Expirada',
    subtitle: 'Verificacion de seguridad',
  });
}

export async function verifyForSensitiveChat(): Promise<boolean> {
  const config = getBiometricConfig();
  if (!config.enabled || !config.requireForSensitiveChats) return true;

  const status = await checkBiometrics();
  if (!status.isAvailable) return true;

  return verifyBiometric('Acceso a chat protegido', {
    title: 'Chat Protegido',
    subtitle: 'Verificacion requerida',
  });
}

// ─── Store/retrieve Supabase session in Keychain/Keystore ───
export async function storeSessionSecurely(accessToken: string, refreshToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.setCredentials({
      username: 'supabase_session',
      password: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      server: 'mx.mexichat.session',
    });
  } catch (err) {
    console.warn('[Biometric] Failed to store session:', err);
  }
}

export async function retrieveSessionSecurely(): Promise<{ access_token: string; refresh_token: string } | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');

    // Require biometric to release tokens
    await NativeBiometric.verifyIdentity({
      reason: 'Autenticacion requerida para acceder a tu sesion',
      title: 'MexiChat',
      subtitle: 'Desbloquear sesion',
      useFallback: true,
      maxAttempts: 3,
    });

    const creds = await NativeBiometric.getCredentials({ server: 'mx.mexichat.session' });
    if (creds.username === 'supabase_session') {
      return JSON.parse(creds.password);
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearSessionSecurely(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.deleteCredentials({ server: 'mx.mexichat.session' });
  } catch {}
}