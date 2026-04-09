import { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, ExternalLink, RefreshCw } from 'lucide-react';
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

// Tile providers with fallback chain
const TILE_PROVIDERS = [
  {
    name: 'CartoDB Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '\u00a9 <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '\u00a9 OpenStreetMap',
    subdomains: 'abc',
    maxZoom: 19,
  },
  {
    name: 'CartoDB Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '\u00a9 <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
];

// Static map fallback URL (no JS needed)
function getStaticMapUrl(lat: number, lng: number, zoom = 15, w = 400, h = 250): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&markers=${lat},${lng},red-pushpin`;
}

export default function LocationMessage({ content, isSent }: LocationMessageProps) {
  const [locData, setLocData] = useState<LocationData | null>(null);
  const [error, setError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const initAttempted = useRef(false);
  const mountedRef = useRef(true);

  // Parse location data
  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      if (
        typeof parsed.lat === 'number' && typeof parsed.lng === 'number' &&
        parsed.lat >= -90 && parsed.lat <= 90 &&
        parsed.lng >= -180 && parsed.lng <= 180 &&
        isFinite(parsed.lat) && isFinite(parsed.lng)
      ) {
        setLocData(parsed);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, [content]);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initialize map with fallback tile providers
  useEffect(() => {
    if (!locData || !mapRef.current) return;

    // Cleanup previous map
    if (leafletMap.current) {
      try { leafletMap.current.remove(); } catch {}
      leafletMap.current = null;
    }
    initAttempted.current = false;
    setMapReady(false);
    setMapFailed(false);

    const container = mapRef.current;
    let map: any;
    let destroyed = false;

    const initMap = async () => {
      if (initAttempted.current || destroyed) return;
      initAttempted.current = true;

      try {
        const L = await import('leaflet');
        if (destroyed || !container || !mountedRef.current) return;

        // Ensure container is empty (Leaflet checks for existing map)
        if ((container as any)._leaflet_id) {
          try { L.DomUtil.remove(container); } catch {}
          delete (container as any)._leaflet_id;
        }

        map = L.map(container, {
          center: [locData.lat, locData.lng],
          zoom: 15,
          scrollWheelZoom: false,
          dragging: false,
          touchZoom: false,
          doubleClickZoom: false,
          zoomControl: false,
          attributionControl: false,
          fadeAnimation: true,
          keyboard: false,
          preferCanvas: true,
        });

        // Try tile providers in order
        let tileLoaded = false;
        for (const provider of TILE_PROVIDERS) {
          if (destroyed) break;
          try {
            const tileLayer = L.tileLayer(provider.url, {
              maxZoom: provider.maxZoom,
              subdomains: provider.subdomains,
              crossOrigin: true,
              errorTileUrl: '',
            });

            await new Promise<void>((resolve, reject) => {
              let loadTimeout: ReturnType<typeof setTimeout>;
              const onLoad = () => { clearTimeout(loadTimeout); tileLoaded = true; resolve(); };
              const onError = () => { clearTimeout(loadTimeout); reject(new Error('Tile load failed')); };
              loadTimeout = setTimeout(() => { reject(new Error('Tile timeout')); }, 8000);
              tileLayer.once('load', onLoad);
              tileLayer.once('tileerror', onError);
              tileLayer.addTo(map);
            });

            if (tileLoaded) break;
          } catch {
            // Try next provider
            continue;
          }
        }

        if (!tileLoaded && !destroyed) {
          // All providers failed — add OSM as last resort (will show partial tiles)
          L.tileLayer(TILE_PROVIDERS[1].url, {
            maxZoom: 19,
            subdomains: 'abc',
          }).addTo(map);
        }

        // WhatsApp-style pin marker
        const pinColor = isSent ? '#25D366' : '#0088cc';
        const icon = L.divIcon({
          html: `<div style="
            width:24px;height:24px;border-radius:50%;
            background:${pinColor};border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            position:relative;
          ">
            <div style="
              position:absolute;bottom:-7px;left:50%;
              transform:translateX(-50%);
              width:0;height:0;
              border-left:7px solid transparent;
              border-right:7px solid transparent;
              border-top:7px solid ${pinColor};
            "></div>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 31],
          className: '',
        });

        L.marker([locData.lat, locData.lng], { icon }).addTo(map);
        leafletMap.current = map;

        // Aggressive invalidateSize — covers all layout timing edge cases
        const invalidate = () => { try { map?.invalidateSize({ animate: false }); } catch {} };
        invalidate();
        setTimeout(invalidate, 50);
        setTimeout(invalidate, 150);
        setTimeout(invalidate, 300);
        setTimeout(invalidate, 600);
        setTimeout(invalidate, 1200);

        // IntersectionObserver: re-invalidate when map scrolls into view
        if (typeof IntersectionObserver !== 'undefined') {
          const obs = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) invalidate();
          }, { threshold: 0.1 });
          obs.observe(container);
          // Cleanup observer on destroy
          const origCleanup = map._leaflet_cleanup;
          map._leaflet_cleanup = () => { obs.disconnect(); origCleanup?.(); };
        }

        if (mountedRef.current) setMapReady(true);
      } catch (err) {
        console.warn('[LocationMessage] Map init failed:', err);
        if (mountedRef.current) setMapFailed(true);
      }
    };

    // Delay init slightly to ensure container is in DOM
    const timer = setTimeout(initMap, 50);

    return () => {
      destroyed = true;
      clearTimeout(timer);
      try { map?.remove(); } catch {}
      leafletMap.current = null;
    };
  }, [locData, isSent, retryCount]);

  const handleRetry = useCallback(() => {
    initAttempted.current = false;
    setRetryCount((c) => c + 1);
  }, []);

  if (error || !locData) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px',
        opacity: 0.7, fontSize: '13px', background: 'rgba(0,0,0,0.04)', borderRadius: '8px',
      }}>
        <MapPin size={16} /> Ubicacion no disponible
      </div>
    );
  }

  const openInMaps = () => {
    // Try native maps first (mobile), then Google Maps
    const mapsUrl = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? `maps://maps.apple.com/?q=${locData.lat},${locData.lng}`
      : `https://www.google.com/maps?q=${locData.lat},${locData.lng}`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <div
      className="mc-location-msg"
      style={{
        borderRadius: '12px', overflow: 'hidden', width: '100%',
        maxWidth: '300px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        background: isSent ? 'rgba(0,0,0,0.04)' : 'var(--mc-bg-secondary, #f5f5f5)',
      }}
    >
      {/* Map area */}
      <div style={{ position: 'relative', width: '100%', height: '180px', background: '#e5e3df' }}>
        {/* Interactive Leaflet map */}
        <div
          ref={mapRef}
          style={{
            width: '100%', height: '100%',
            position: 'absolute', top: 0, left: 0,
            zIndex: 0, isolation: 'isolate',
            opacity: mapReady ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* Static image fallback while map loads or if map fails */}
        {(!mapReady || mapFailed) && (
          <img
            src={getStaticMapUrl(locData.lat, locData.lng)}
            alt="Mapa"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              position: 'absolute', top: 0, left: 0,
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        {/* Loading shimmer */}
        {!mapReady && !mapFailed && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(229,227,223,0.6)', zIndex: 1,
          }}>
            <div style={{
              width: '28px', height: '28px', border: '3px solid rgba(0,0,0,0.1)',
              borderTop: '3px solid var(--mc-blue, #0088cc)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {/* Retry button on failure */}
        {mapFailed && (
          <button
            onClick={handleRetry}
            style={{
              position: 'absolute', bottom: '8px', right: '8px', zIndex: 2,
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '16px', fontSize: '11px',
              background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)',
              cursor: 'pointer', color: '#333', fontWeight: 600,
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }}
          >
            <RefreshCw size={12} /> Reintentar
          </button>
        )}

        {/* Accuracy badge */}
        {locData.accuracy && locData.accuracy > 0 && (
          <div style={{
            position: 'absolute', top: '6px', right: '6px', zIndex: 2,
            padding: '2px 6px', borderRadius: '8px', fontSize: '10px',
            background: 'rgba(0,0,0,0.5)', color: '#fff', fontWeight: 500,
            backdropFilter: 'blur(4px)',
          }}>
            ±{locData.accuracy}m
          </div>
        )}
      </div>

      {/* Bottom bar — WhatsApp style */}
      <div
        onClick={openInMaps}
        style={{
          padding: '10px 12px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', cursor: 'pointer',
          background: isSent ? 'rgba(0,0,0,0.04)' : 'var(--mc-bg-secondary, #f5f5f5)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', minWidth: 0, fontWeight: 500 }}>
          <MapPin size={15} style={{ flexShrink: 0, color: isSent ? '#25D366' : 'var(--mc-blue, #0088cc)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {locData.label || 'Mi ubicacion'}
          </span>
        </div>
        <ExternalLink size={15} style={{ color: 'var(--mc-blue, #0088cc)', flexShrink: 0, marginLeft: '8px' }} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}