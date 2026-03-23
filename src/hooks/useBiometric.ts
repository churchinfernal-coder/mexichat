/**
 * useBiometric — React hook for biometric auth integration
 *
 * Provides:
 * - Device capability check
 * - Enable/disable biometric settings
 * - Inactivity monitoring + auto-lock
 * - Payment verification gate
 * - App-open verification gate
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  checkBiometrics,
  getBiometricConfig,
  saveBiometricConfig,
  verifyBiometric,
  verifyForAppOpen,
  verifyForPayment,
  verifyForInactivity,
  recordActivity,
  isInactivityExpired,
  type BiometricStatus,
  type BiometricConfig,
} from '@/services/biometric';

export function useBiometric() {
  const [status, setStatus] = useState<BiometricStatus>({ isAvailable: false, biometryType: 'none', isEnrolled: false });
  const [config, setConfig] = useState<BiometricConfig>(getBiometricConfig());
  const [isLocked, setIsLocked] = useState(false);
  const activityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check device biometric capability on mount
  useEffect(() => {
    checkBiometrics().then(setStatus);
  }, []);

  // Inactivity monitor
  useEffect(() => {
    if (!config.enabled || config.inactivityTimeoutMinutes <= 0) return;

    // Record activity on user interactions
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => recordActivity();
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));

    // Check inactivity every 30 seconds
    activityTimerRef.current = setInterval(() => {
      if (isInactivityExpired()) {
        setIsLocked(true);
      }
    }, 30_000);

    return () => {
      events.forEach(e => document.removeEventListener(e, handleActivity));
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    };
  }, [config.enabled, config.inactivityTimeoutMinutes]);

  // Enable biometric auth
  const enable = useCallback(async () => {
    const s = await checkBiometrics();
    if (!s.isAvailable) return false;

    // Test biometric works
    const ok = await verifyBiometric('Activa la autenticacion biometrica');
    if (!ok) return false;

    const updated = saveBiometricConfig({ enabled: true });
    setConfig(updated);
    recordActivity();
    return true;
  }, []);

  // Disable biometric auth
  const disable = useCallback(() => {
    const updated = saveBiometricConfig({ enabled: false });
    setConfig(updated);
    setIsLocked(false);
  }, []);

  // Update specific config options
  const updateConfig = useCallback((partial: Partial<BiometricConfig>) => {
    const updated = saveBiometricConfig(partial);
    setConfig(updated);
  }, []);

  // Unlock after inactivity lock
  const unlockInactivity = useCallback(async (): Promise<boolean> => {
    const ok = await verifyForInactivity();
    if (ok) {
      setIsLocked(false);
      recordActivity();
    }
    return ok;
  }, []);

  // Gate: verify before payment
  const gatePayment = useCallback(async (amount?: number): Promise<boolean> => {
    return verifyForPayment(amount);
  }, []);

  // Gate: verify on app open
  const gateAppOpen = useCallback(async (): Promise<boolean> => {
    return verifyForAppOpen();
  }, []);

  return {
    status,
    config,
    isLocked,
    enable,
    disable,
    updateConfig,
    unlockInactivity,
    gatePayment,
    gateAppOpen,
    verify: verifyBiometric,
  };
}