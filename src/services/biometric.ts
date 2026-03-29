import { Capacitor } from '@capacitor/core';

export type BiometryType = 'fingerprint' | 'face' | 'iris' | 'none';
export interface BiometricStatus { isAvailable: boolean; biometryType: BiometryType; isEnrolled: boolean; }
export interface BiometricConfig { enabled: boolean; requireForAppOpen: boolean; requireForPayments: boolean; requireForSensitiveChats: boolean; inactivityTimeoutMinutes: number; }

const CONFIG_KEY = 'mc_biometric_config';
const LAST_ACTIVITY_KEY = 'mc_last_activity';
const DEFAULT_CONFIG: BiometricConfig = { enabled: false, requireForAppOpen: false, requireForPayments: false, requireForSensitiveChats: false, inactivityTimeoutMinutes: 0 };
const SAFE_STATUS: BiometricStatus = { isAvailable: false, biometryType: 'none', isEnrolled: false };

export function getBiometricConfig(): BiometricConfig {
  try { const s = localStorage.getItem(CONFIG_KEY); if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }; } catch {}
  return DEFAULT_CONFIG;
}
export function saveBiometricConfig(config: Partial<BiometricConfig>): BiometricConfig {
  const updated = { ...getBiometricConfig(), ...config };
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}
export function recordActivity(): void { try { localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString()); } catch {} }
export function isInactivityExpired(): boolean { return false; }
export async function checkBiometrics(): Promise<BiometricStatus> { return SAFE_STATUS; }
export async function verifyBiometric(_reason?: string, _options?: any): Promise<boolean> { return true; }
export async function verifyForAppOpen(): Promise<boolean> { return true; }
export async function verifyForPayment(_amount?: number): Promise<boolean> { return true; }
export async function verifyForInactivity(): Promise<boolean> { return true; }
export async function verifyForSensitiveChat(): Promise<boolean> { return true; }
export async function storeSessionSecurely(_a: string, _r: string): Promise<void> {}
export async function retrieveSessionSecurely(): Promise<any> { return null; }
export async function clearSessionSecurely(): Promise<void> {}