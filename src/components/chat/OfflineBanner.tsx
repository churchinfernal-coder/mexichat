import { useState, useEffect } from 'react';

const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => { setIsOffline(true); setWasOffline(true); };
    const goOnline = () => {
      setIsOffline(false);
      setTimeout(() => setWasOffline(false), 3000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline && !wasOffline) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600,
      background: isOffline ? '#ef4444' : '#22c55e',
      color: 'white',
      transition: 'all 0.3s ease',
      animation: 'offlineBannerSlide 0.3s ease-out',
    }}>
      {isOffline
        ? '\u26A0\uFE0F Sin conexi\u00F3n \u2014 Los mensajes se enviar\u00E1n cuando reconectes'
        : '\u2705 Conexi\u00F3n restaurada'
      }
      <style>{`
        @keyframes offlineBannerSlide {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default OfflineBanner;