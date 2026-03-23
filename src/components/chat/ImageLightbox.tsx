import React, { useEffect } from 'react';

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const ImageLightbox: React.FC<LightboxProps> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
        animation: 'lbFadeIn 0.2s ease-out',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '16px', right: '16px',
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: 'white', fontSize: '20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        {'\u2715'}
      </button>
      <img
        src={src}
        alt={alt || 'Media'}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '95vw', maxHeight: '90vh',
          objectFit: 'contain', borderRadius: '8px',
          cursor: 'default',
          animation: 'lbZoomIn 0.25s ease-out',
        }}
      />
      <style>{`
        @keyframes lbFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lbZoomIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default ImageLightbox;