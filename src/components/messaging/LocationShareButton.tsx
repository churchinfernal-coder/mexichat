import { useState, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LocationShareButtonProps {
  onSendLocation: (content: string, mediaType: string) => void;
  onClose?: () => void;
}

export default function LocationShareButton({ onSendLocation, onClose }: LocationShareButtonProps) {
  const [loading, setLoading] = useState(false);

  const shareCurrentLocation = useCallback(() => {
    try {
      if (!navigator.geolocation) {
        toast.error('Tu navegador no soporta geolocalizacion');
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            const locationData = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: Math.round(position.coords.accuracy),
              label: 'Mi ubicacion',
              timestamp: Date.now(),
            };
            onSendLocation(JSON.stringify(locationData), 'location');
            onClose?.();
            toast.success('Ubicacion compartida');
          } catch (e) {
            console.error('[LocationShare] Failed to send:', e);
            toast.error('Error al enviar ubicacion');
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          setLoading(false);
          const msgs: Record<number, string> = {
            1: 'Permiso de ubicacion denegado. Habilitalo en la configuracion de tu navegador.',
            2: 'Ubicacion no disponible. Verifica que el GPS este activo.',
            3: 'Tiempo de espera agotado al obtener ubicacion.',
          };
          toast.error(msgs[err.code] || 'Error al obtener ubicacion');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } catch (e) {
      setLoading(false);
      console.error('[LocationShare] Unexpected error:', e);
      toast.error('Error inesperado al compartir ubicacion');
    }
  }, [onSendLocation, onClose]);

  return (
    <button
      onClick={shareCurrentLocation}
      disabled={loading}
      title="Compartir ubicacion"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
    >
      {loading ? <Loader2 size={18} className="spin" /> : <MapPin size={18} />}
    </button>
  );
}