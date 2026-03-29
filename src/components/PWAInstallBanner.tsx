/**
 * MEXICHAT — PWA Install Banner
 *
 * Floating bottom banner that prompts users to install the app.
 * - Chrome/Edge: Shows native install prompt
 * - iOS Safari: Shows step-by-step instructions
 * - Already installed or dismissed: Hidden
 *
 * Placement: Rendered in App.tsx — shows on all pages
 */

import { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X, Share, Plus, Smartphone, Monitor, ChevronUp, MessageCircle } from 'lucide-react';

const C = {
  bg: 'rgba(248,250,252,0.97)',
  border: 'rgba(29,78,216,0.15)',
  blue: '#1d4ed8',
  blueDark: '#1e40af',
  text: '#0f172a',
  textBody: '#64748b',
  textMuted: '#94a3b8',
} as const;

export const PWAInstallBanner: React.FC = () => {
  const pwa = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Don't show if: installed, dismissed, or can't install
  if (pwa.isInstalled || pwa.dismissed || !pwa.canInstall) return null;

  const handleInstall = async () => {
    if (pwa.isIOS) {
      setShowIOSGuide(true);
      return;
    }
    await pwa.install();
  };

  const platformIcon = pwa.isIOS || pwa.isAndroid
    ? <Smartphone className="h-5 w-5" />
    : <Monitor className="h-5 w-5" />;

  const platformText = pwa.isIOS
    ? 'Instalar en iPhone'
    : pwa.isAndroid
      ? 'Instalar en Android'
      : 'Instalar App';

  return (
    <>
      {/* ═══ MAIN BANNER ═══ */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: C.bg,
          borderTop: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '12px 16px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.08)',
          animation: 'slideUp 0.4s ease-out',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '600px', margin: '0 auto' }}>
          {/* App icon */}
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: `linear-gradient(135deg, ${C.blue}, ${C.blueDark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
          }}>
            <MessageCircle className="h-5 w-5" style={{ color: 'white' }} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
              Mexi<span style={{ color: C.blue }}>Chat</span>
            </div>
            <div style={{ fontSize: '11px', color: C.textBody, marginTop: '2px' }}>
              Instala la app para notificaciones y llamadas
            </div>
          </div>

          {/* Install button */}
          <button
            onClick={handleInstall}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: `linear-gradient(135deg, ${C.blue}, ${C.blueDark})`,
              color: 'white', fontWeight: 700, fontSize: '12px',
              cursor: 'pointer', flexShrink: 0, transition: 'transform 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Download className="h-3.5 w-3.5" />
            {platformText}
          </button>

          {/* Dismiss X */}
          <button
            onClick={pwa.dismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              color: C.textMuted, flexShrink: 0,
            }}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ═══ iOS GUIDE MODAL ═══ */}
      {showIOSGuide && (
        <div
          onClick={() => setShowIOSGuide(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '20px 20px 0 0',
              padding: '24px 20px 36px', width: '100%', maxWidth: '420px',
              border: `1px solid ${C.border}`, borderBottom: 'none',
            }}
          >
            {/* Handle bar */}
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />

            <h3 style={{ color: C.text, fontSize: '18px', fontWeight: 700, textAlign: 'center', marginBottom: '20px' }}>
              Instalar Mexi<span style={{ color: C.blue }}>Chat</span>
            </h3>

            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(29,78,216,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(29,78,216,0.15)' }}>
                <Share className="h-4 w-4" style={{ color: C.blue }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
                  1. Toca el botón <span style={{ color: C.blue }}>Compartir</span>
                </div>
                <div style={{ fontSize: '11px', color: C.textBody }}>
                  En la barra inferior de Safari
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(29,78,216,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(29,78,216,0.15)' }}>
                <Plus className="h-4 w-4" style={{ color: C.blue }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
                  2. Selecciona <span style={{ color: C.blue }}>Añadir a pantalla de inicio</span>
                </div>
                <div style={{ fontSize: '11px', color: C.textBody }}>
                  Desplázate en el menú hasta encontrarlo
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(29,78,216,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(29,78,216,0.15)' }}>
                <Download className="h-4 w-4" style={{ color: C.blue }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
                  3. Toca <span style={{ color: C.blue }}>Añadir</span>
                </div>
                <div style={{ fontSize: '11px', color: C.textBody }}>
                  ?Listo! La app aparecerá en tu pantalla de inicio
                </div>
              </div>
            </div>

            {/* Arrow pointing down */}
            <div style={{ textAlign: 'center' }}>
              <ChevronUp className="h-6 w-6 mx-auto animate-bounce" style={{ color: C.blue, transform: 'rotate(180deg)' }} />
              <p style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>
                Busca el ícono <Share className="inline h-3 w-3" style={{ color: C.blue }} /> abajo en Safari
              </p>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              style={{
                width: '100%', marginTop: '16px', padding: '12px',
                borderRadius: '10px', border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text,
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallBanner;