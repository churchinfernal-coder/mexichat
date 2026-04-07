/**
 * useMFA - TOTP Two-Factor Authentication via Supabase MFA API
 *
 * Supports:
 * - Enroll (generate QR code for authenticator app)
 * - Verify (validate 6-digit TOTP code)
 * - Unenroll (disable 2FA)
 * - Challenge + Verify on login (if enrolled)
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MFAState {
  isEnrolled: boolean;
  isVerified: boolean;
  loading: boolean;
  factorId: string | null;
  qrCode: string | null;
  secret: string | null;
  error: string | null;
}

export function useMFA() {
  const [state, setState] = useState<MFAState>({
    isEnrolled: false,
    isVerified: false,
    loading: true,
    factorId: null,
    qrCode: null,
    secret: null,
    error: null,
  });

  // Check current MFA enrollment status
  const checkEnrollment = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactors = data.totp || [];
      const verifiedFactor = totpFactors.find(f => f.status === 'verified');
      const unverifiedFactor = totpFactors.find(f => (f.status as string) === 'unverified');

      setState(prev => ({
        ...prev,
        isEnrolled: !!verifiedFactor,
        factorId: verifiedFactor?.id || unverifiedFactor?.id || null,
        loading: false,
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { checkEnrollment(); }, [checkEnrollment]);

  // Enroll: generate QR code for authenticator app
  const enroll = useCallback(async (): Promise<{ qr: string; secret: string } | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'MexiChat Authenticator',
      });
      if (error) throw error;

      setState(prev => ({
        ...prev,
        loading: false,
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      }));

      return { qr: data.totp.qr_code, secret: data.totp.secret };
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return null;
    }
  }, []);

  // Verify: validate TOTP code after enrollment or on login challenge
  const verify = useCallback(async (code: string): Promise<boolean> => {
    if (!state.factorId) {
      setState(prev => ({ ...prev, error: 'No hay factor registrado' }));
      return false;
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Create challenge
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: state.factorId,
      });
      if (challengeErr) throw challengeErr;

      // Verify with code
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: state.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      setState(prev => ({
        ...prev,
        loading: false,
        isEnrolled: true,
        isVerified: true,
        qrCode: null,
        secret: null,
      }));
      return true;
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return false;
    }
  }, [state.factorId]);

  // Unenroll: disable 2FA
  const unenroll = useCallback(async (): Promise<boolean> => {
    if (!state.factorId) return false;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: state.factorId });
      if (error) throw error;

      setState({
        isEnrolled: false,
        isVerified: false,
        loading: false,
        factorId: null,
        qrCode: null,
        secret: null,
        error: null,
      });
      return true;
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return false;
    }
  }, [state.factorId]);

  // Get current AAL (Authenticator Assurance Level)
  const getAAL = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return null;
    return data;
  }, []);

  return {
    ...state,
    enroll,
    verify,
    unenroll,
    checkEnrollment,
    getAAL,
  };
}