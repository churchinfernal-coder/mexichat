import { useEffect, useState, useRef } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface LocationData {
  lat: number;
  lng: number;
  label?: string;
  accuracy?: number;
}

interface LocationMessageProps {
  content: string;
  isSent: boolean;
}

export default function LocationMessage({ content, isSent }: LocationMessageProps) {
  const [locData, setLocData] = useState<LocationData | null>(null);
  const [error, setError] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' &&
          parsed.lat >= -90 && parsed.lat <= 90 && parsed.lng >= -180 && parsed.lng <= 180) {
        setLocData(parsed);
      } else { setError(true); }
    } catch { setError(true); }
  }, [content]);

  useEffect(() => {
    if (!locData || !mapRef.current || leafletMap.current) return;
    const container = mapRef.current;
    let map: any;

    import('leaflet').then((L) => {
      if (!container || leafletMap.current) return;

      const icon = L.divIcon({
        html: '<div style="width:20px;height:20px;border-radius:50%;background:' + (isSent ? '#25D366' : '#0088cc') + ';border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);position:relative;"><div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ' + (isSent ? '#25D366' : '#0088cc') + ';"></div></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 26],
        className: '',
      });

      map = L.map(container, {
        center: [locData.lat, locData.lng],
        zoom: 15,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false,
        keyboard: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.marker([locData.lat, locData.lng], { icon }).addTo(map);
      leafletMap.current = map;

      setTimeout(() => { map.invalidateSize(); }, 100);
      setTimeout(() => { map.invalidateSize(); }, 400);
      setTimeout(() => { map.invalidateSize(); }, 800);
    }).catch(() => {});

    return () => {
      try { map?.remove(); } catch {}
      leafletMap.current = null;
    };
  }, [locData, isSent]);

  if (error || !locData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', opacity: 0.7, fontSize: '13px' }}>
        <MapPin size={16} /> Ubicacion no disponible
      </div>
    );
  }

  const openInMaps = () => {
    window.open('https://www.google.com/maps?q=' + locData.lat + ',' + locData.lng, '_blank');
  };

  return (
    <div className="mc-location-msg" style={{ borderRadius: '8px', overflow: 'hidden', width: '100%', maxWidth: '260px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '140px',
          background: '#e5e3df',
          position: 'relative',
          zIndex: 0,
          isolation: 'isolate',
        }}
      />
      <div
        onClick={openInMaps}
        style={{
          padding: '8px 10px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', background: isSent ? 'rgba(0,0,0,0.06)' : 'var(--mc-bg-secondary, #f5f5f5)',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', minWidth: 0 }}>
          <MapPin size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locData.label || 'Ubicacion compartida'}</span>
        </div>
        <ExternalLink size={14} style={{ color: 'var(--mc-blue, #0088cc)', flexShrink: 0, marginLeft: '6px' }} />
      </div>
    </div>
  );
}