/**
 * MexiChat Onboarding Modal
 * Shown once after first login — requests notification + contact permissions
 */
import { useState, useCallback } from 'react';
import { Bell, Users, Shield, ArrowRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { syncContactHashes, setOwnHash } from '@/services/contactSync';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingModalProps {
  userId: string;
  onComplete: () => void;
}

export default function OnboardingModal({ userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  const requestNotifications = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions();
        return result.receive === 'granted';
      } else if ('Notification' in window) {
        const result = await Notification.requestPermission();
        return result === 'granted';
      }
    } catch (err) {
      console.warn('[Onboarding] Notification permission error:', err);
    }
    return false;
  }, []);

  const requestContacts = useCallback(async () => {
    try {
      // Sync device contacts → hashed in Supabase
      const synced = await syncContactHashes(userId);
      console.log(`[Onboarding] Synced ${synced} contact hashes`);

      // Also set own hash so others can discover us
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await setOwnHash(userId, user.phone || undefined, user.email || undefined);
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
      color: '#f59e0b',
      title: 'Recibe mensajes al instante',
      desc: 'Activa las notificaciones para no perderte ning\u00FAn mensaje, llamada o pago.',
      action: 'Activar notificaciones',
      handler: requestNotifications,
    },
    {
      icon: <Users size={40} />,
      color: '#22c55e',
      title: 'Encuentra tus amigos',
      desc: 'Sincroniza tus contactos para ver qui\u00E9n ya usa MexiChat. Solo se comparten hashes cifrados, nunca tus datos.',
      action: 'Sincronizar contactos',
      handler: requestContacts,
    },
  ];

  const currentStep = steps[step];

  const handleAction = async () => {
    if (currentStep) await currentStep.handler();
    nextStep();
  };

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem(`mexichat_onboarded_${userId}`, 'true');
      onComplete();
    }
  };

  if (!currentStep) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--mc-bg, #fff)', borderRadius: '24px',
        padding: '40px 28px 28px', maxWidth: '380px', width: '100%',
        textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '28px' }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? '24px' : '8px', height: '8px',
              borderRadius: '4px', transition: 'all 0.3s',
              background: i <= step ? currentStep.color : 'rgba(148,163,184,0.3)',
              opacity: i <= step ? 1 : 0.4,
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: `${currentStep.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', color: currentStep.color,
        }}>
          {currentStep.icon}
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--mc-text, #0f172a)', marginBottom: '8px' }}>
          {currentStep.title}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--mc-text-muted, #64748b)', lineHeight: 1.5, marginBottom: '28px' }}>
          {currentStep.desc}
        </p>

        <button onClick={handleAction} style={{
          width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
          background: currentStep.color, color: 'white', fontWeight: 700,
          fontSize: '15px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginBottom: '12px',
        }}>
          {currentStep.action}
          <ArrowRight size={18} />
        </button>

        <button onClick={nextStep} style={{
          background: 'none', border: 'none', color: 'var(--mc-text-muted, #94a3b8)',
          fontSize: '13px', cursor: 'pointer', padding: '8px',
        }}>
          Ahora no
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
          marginTop: '16px', fontSize: '11px', color: 'var(--mc-text-muted, #94a3b8)',
        }}>
          <Shield size={12} />
          Tus datos est\u00E1n protegidos con cifrado E2E
        </div>
      </div>
    </div>
  );
}