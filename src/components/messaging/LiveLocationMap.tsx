import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Navigation, Users } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BROADCAST_INTERVAL = 5000;

interface LiveLocationMapProps {
  durationMinutes?: number;
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
  otherUserName: string;
  onClose: () => void;
}

interface UserLocation {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export default function LiveLocationMap({
  conversationId, currentUserId, currentUserName, otherUserName, onClose, durationMinutes = 15,
}: LiveLocationMapProps) {
  const LIVE_DURATION = useMemo(() => durationMinutes * 60 * 1000, [durationMinutes]);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const leafletRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);
  const [locations, setLocations] = useState<Record<string, UserLocation>>({});
  const [timeLeft, setTimeLeft] = useState(LIVE_DURATION);
  const startTimeRef = useRef<number>(0);

  const channelName = 'live-location-' + conversationId;

  const durationLabel = useMemo(() => {
    if (durationMinutes < 60) return durationMinutes + ' min';
    const h = Math.floor(durationMinutes / 60);
    const m = durationMinutes % 60;
    return m > 0 ? h + 'h ' + m + 'min' : h + (h === 1 ? ' hora' : ' horas');
  }, [durationMinutes]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    let map: any;
    import('leaflet').then((L) => {
      if (!mapContainer.current || mapRef.current) return;
      leafletRef.current = L;
      map = L.map(mapContainer.current, {
        center: [19.4326, -99.1332],
        zoom: 13,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '\u00a9 OpenStreetMap',
      }).addTo(map);
      setTimeout(() => { map.invalidateSize(); }, 200);
      mapRef.current = map;
    }).catch((e) => { console.error('[LiveLocation] Leaflet init failed:', e); });
    return () => { try { map?.remove(); } catch {} mapRef.current = null; };
  }, []);

  // Subscribe to broadcast channel
  useEffect(() => {
    try {
      const channel = supabase.channel(channelName);
      channel.on('broadcast', { event: 'location-update' }, ({ payload }) => {
        try {
          if (payload && payload.userId && payload.userId !== currentUserId) {
            setLocations(prev => ({ ...prev, [payload.userId]: payload as UserLocation }));
          }
        } catch (e) { console.warn('[LiveLocation] Bad payload:', e); }
      }).subscribe();
      channelRef.current = channel;
    } catch (e) { console.error('[LiveLocation] Channel error:', e); }
    return () => { try { if (channelRef.current) supabase.removeChannel(channelRef.current); } catch {} };
  }, [channelName, currentUserId]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    let hasNew = false;
    Object.entries(locations).forEach(([userId, loc]) => {
      if (markersRef.current[userId]) {
        markersRef.current[userId].setLatLng([loc.lat, loc.lng]);
      } else {
        const isMe = userId === currentUserId;
        const icon = L.divIcon({
          html: '<div style="width:32px;height:32px;border-radius:50%;background:' + (isMe ? '#25D366' : '#0088cc') + ';border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">' + loc.userName.charAt(0).toUpperCase() + '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          className: '',
        });
        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
        marker.bindPopup(isMe ? 'Tu' : loc.userName);
        markersRef.current[userId] = marker;
        hasNew = true;
      }
    });
    if (hasNew) {
      const locs = Object.values(locations);
      if (locs.length === 1) {
        map.flyTo([locs[0].lat, locs[0].lng], 15);
      } else if (locs.length > 1) {
        try {
          const bounds = L.latLngBounds(locs.map((l: UserLocation) => [l.lat, l.lng]));
          map.fitBounds(bounds, { padding: [40, 40] });
        } catch {}
      }
    }
  }, [locations, currentUserId]);

  // Countdown timer
  useEffect(() => {
    if (!sharing) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, LIVE_DURATION - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) stopSharing();
    }, 1000);
    return () => clearInterval(timer);
  }, [sharing, LIVE_DURATION]);

  const broadcastLocation = useCallback((position: GeolocationPosition) => {
    try {
      const loc: UserLocation = {
        userId: currentUserId, userName: currentUserName,
        lat: position.coords.latitude, lng: position.coords.longitude,
        timestamp: Date.now(),
      };
      setLocations(prev => ({ ...prev, [currentUserId]: loc }));
      supabase.channel(channelName).send({
        type: 'broadcast', event: 'location-update', payload: loc,
      });
    } catch (e) { console.warn('[LiveLocation] Broadcast error:', e); }
  }, [channelName, currentUserId, currentUserName]);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation) { toast.error('Geolocalizacion no disponible'); return; }
    startTimeRef.current = Date.now();
    setSharing(true);
    setTimeLeft(LIVE_DURATION);
    navigator.geolocation.getCurrentPosition(broadcastLocation, () => {
      toast.error('No se pudo obtener tu ubicacion');
      setSharing(false);
    }, { enableHighAccuracy: true, timeout: 15000 });
    watchIdRef.current = navigator.geolocation.watchPosition(
      broadcastLocation, () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(broadcastLocation, () => {}, { enableHighAccuracy: true });
    }, BROADCAST_INTERVAL);
    toast.success('Compartiendo ubicacion en tiempo real (' + durationLabel + ')');
  }, [broadcastLocation, LIVE_DURATION, durationLabel]);

  const stopSharing = useCallback(() => {
    try {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } catch {}
    watchIdRef.current = null;
    intervalRef.current = null;
    setSharing(false);
    toast.info('Dejaste de compartir ubicacion');
  }, []);

  const handleClose = useCallback(() => { stopSharing(); onClose(); }, [stopSharing, onClose]);

  const formatTime = (ms: number) => {
    if (ms >= 3600000) {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return h + ':' + m.toString().padStart(2, '0') + ':' + Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    }
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins + ':' + secs.toString().padStart(2, '0');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--mc-bg, #fff)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--mc-border, #eee)', background: 'var(--mc-bg-secondary, #f8f8f8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={20} style={{ color: 'var(--mc-blue, #0088cc)' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Ubicacion en tiempo real</div>
            {sharing ? (
              <div style={{ fontSize: '11px', color: 'var(--mc-text-muted, #888)' }}>{'Compartiendo \u2022 ' + formatTime(timeLeft) + ' restantes'}</div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--mc-text-muted, #888)' }}>{'Duracion: ' + durationLabel}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {sharing ? (
            <button onClick={stopSharing} style={{ padding: '6px 14px', borderRadius: '16px', border: 'none', cursor: 'pointer', background: '#e74c3c', color: 'white', fontSize: '13px', fontWeight: 600 }}>Detener</button>
          ) : (
            <button onClick={startSharing} style={{ padding: '6px 14px', borderRadius: '16px', border: 'none', cursor: 'pointer', background: 'var(--mc-blue, #0088cc)', color: 'white', fontSize: '13px', fontWeight: 600 }}>Compartir mi ubicacion</button>
          )}
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={22} /></button>
        </div>
      </div>
      <div ref={mapContainer} style={{ flex: 1, minHeight: 0 }} />
      <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--mc-text-muted, #888)', borderTop: '1px solid var(--mc-border, #eee)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Users size={14} />
        {Object.keys(locations).length === 0 ? 'Esperando ubicaciones...' : Object.keys(locations).length + ' persona(s) compartiendo'}
      </div>
    </div>
  );
}