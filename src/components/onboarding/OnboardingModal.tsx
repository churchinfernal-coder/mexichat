/**
 * MexiChat Onboarding Modal
 * Shown once after first login — requests notification + contact permissions
 * Matches MexiChat blue brand theme. Carrier-grade with timeouts & fallbacks.
 */
import { useState, useCallback } from 'react';
import { Bell, Users, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { syncContactHashes, setOwnHash } from '@/services/contactSync';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingModalProps {
  userId: string;
  onComplete: () => void;
}

/** Wrap any async call with a timeout so the user is never stuck */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Brand colors
const BLUE = '#2563eb';
const BLUE_LIGHT = 'rgba(37, 99, 235, 0.1)';

export default function OnboardingModal({ userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(`mexichat_onboarded_${userId}`, 'true');
    } catch (_) { /* storage full — non-blocking */ }
    onComplete();
  }, [userId, onComplete]);

  const nextStep = useCallback(() => {
    if (step < 1) {
      setStep(1);
    } else {
      finish();
    }
  }, [step, finish]);

  const requestNotifications = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Check current status first
        const check = await withTimeout(
          PushNotifications.checkPermissions(),
          5000,
          { receive: 'prompt' as const }
        );

        if (check.receive === 'granted') return true;

        // Request permission with timeout
        const result = await withTimeout(
          PushNotifications.requestPermissions(),
          10000,
          { receive: 'denied' as const }
        );

        if (result.receive === 'granted') {
          // Register for push after grant
          await withTimeout(PushNotifications.register(), 5000, undefined);
          return true;
        }
        return false;
      } else if ('Notification' in window) {
        const result = await withTimeout(
          Notification.requestPermission().then((r) => r),
          10000,
          'denied' as NotificationPermission
        );
        return result === 'granted';
      }
    } catch (err) {
      console.warn('[Onboarding] Notification permission error:', err);
    }
    return false;
  }, []);

  const requestContacts = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Request contacts permission first
        try {
          const { Contacts } = await import('@capacitor-community/contacts');
          const perm = await withTimeout(
            Contacts.requestPermissions(),
            10000,
            { contacts: 'denied' as const }
          );
          if (perm.contacts !== 'granted') {
            console.warn('[Onboarding] Contacts permission denied');
            return false;
          }
        } catch (err) {
          console.warn('[Onboarding] Contacts plugin not available:', err);
          // Fall through — syncContactHashes may handle web fallback
        }
      }

      // Sync device contacts → hashed in Supabase
      const synced = await withTimeout(syncContactHashes(userId), 15000, 0);
      console.log(`[Onboarding] Synced ${synced} contact hashes`);

      // Also set own hash so others can discover us
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await withTimeout(
          setOwnHash(userId, user.phone || undefined, user.email || undefined),
          5000,
          undefined
        );
      }
      return synced > 0;
    } catch (err) {
      console.warn('[Onboarding] Contact sync error:', err);
      return false;
    }
  }, [userId]);

  const steps = [
    {
      icon: <Bell size={40} />,
      title: 'Recibe mensajes al instante',
      desc: 'Activa las notificaciones para no perderte ningún mensaje, llamada o pago.',
      action: 'Activar notificaciones',
      handler: requestNotifications,
    },
    {
      icon: <Users size={40} />,
      title: 'Encuentra tus amigos',
      desc: 'Sincroniza tus contactos para ver quién ya usa MexiChat. Solo se comparten hashes cifrados, nunca tus datos.',
      action: 'Sincronizar contactos',
      handler: requestContacts,
    },
  ];

  const currentStep = steps[step];

  const handleAction = async () => {
    if (loading) return; // Prevent double-tap
    setLoading(true);
    try {
      if (currentStep) {
        await currentStep.handler();
      }
    } catch (err) {
      console.warn('[Onboarding] Step handler error:', err);
    } finally {
      setLoading(false);
      nextStep();
    }
  };

  if (!currentStep) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 10, 30, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '40px 28px 28px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(37, 99, 235, 0.08)',
        }}
      >
        {/* Progress dots */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            justifyContent: 'center',
            marginBottom: '28px',
          }}
        >
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                transition: 'all 0.3s ease',
                background: i <= step ? BLUE : 'rgba(148, 163, 184, 0.3)',
                opacity: i <= step ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: BLUE_LIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: BLUE,
          }}
        >
          {currentStep.icon}
        </div>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '8px',
          }}
        >
          {currentStep.title}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: '#64748b',
            lineHeight: 1.5,
            marginBottom: '28px',
          }}
        >
          {currentStep.desc}
        </p>

        {/* Action button */}
        <button
          onClick={handleAction}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: 'none',
            background: loading ? '#93c5fd' : BLUE,
            color: 'white',
            fontWeight: 700,
            fontSize: '15px',
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '12px',
            transition: 'background 0.2s ease',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Procesando...
            </>
          ) : (
            <>
              {currentStep.action}
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {/* Skip button */}
        <button
          onClick={() => {
            setLoading(false);
            nextStep();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          Ahora no
        </button>

        {/* E2E badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'center',
            marginTop: '16px',
            fontSize: '11px',
            color: '#94a3b8',
          }}
        >
          <Shield size={12} />
          Tus datos están protegidos con cifrado E2E
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}