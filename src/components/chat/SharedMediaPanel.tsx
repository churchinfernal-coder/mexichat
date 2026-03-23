import React, { useEffect } from 'react';
import { X as XIcon, Image as ImageIcon, Film, FileText, Music, Link as LinkIcon } from 'lucide-react';
import type { SharedMediaItem, MediaTab } from '@/hooks/useSharedMedia';

export interface SharedMediaPanelProps {
  open: boolean;
  items: SharedMediaItem[];
  activeTab: MediaTab;
  loading: boolean;
  scopeType: 'conversation' | 'group';
  scopeId: string;
  onLoadMedia: (scopeType: 'conversation' | 'group', scopeId: string, tab: MediaTab) => void;
  onClose: () => void;
  onOpenImage?: (url: string) => void;
}

const TABS: { key: MediaTab; label: string; icon: React.ReactNode }[] = [
  { key: 'photos', label: 'Fotos', icon: <ImageIcon size={14} /> },
  { key: 'videos', label: 'Videos', icon: <Film size={14} /> },
  { key: 'files', label: 'Archivos', icon: <FileText size={14} /> },
  { key: 'audio', label: 'Audio', icon: <Music size={14} /> },
  { key: 'links', label: 'Enlaces', icon: <LinkIcon size={14} /> },
];

const SharedMediaPanel: React.FC<SharedMediaPanelProps> = ({
  open, items, activeTab, loading, scopeType, scopeId, onLoadMedia, onClose, onOpenImage,
}) => {
  useEffect(() => {
    if (open && scopeId) onLoadMedia(scopeType, scopeId, activeTab);
  }, [open, scopeId, scopeType, activeTab, onLoadMedia]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--mc-border)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mc-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--mc-text)' }}>Media Compartida</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}><XIcon size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--mc-border)', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onLoadMedia(scopeType, scopeId, tab.key)}
              style={{
                flex: 1, padding: '10px 8px', background: 'none', border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--mc-blue)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--mc-blue)' : 'var(--mc-text-muted)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--mc-text-muted)' }}>Cargando...</div>}

          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--mc-text-muted)', fontSize: '14px' }}>No hay contenido</div>
          )}

          {!loading && (activeTab === 'photos' || activeTab === 'videos') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => item.type === 'image' && onOpenImage?.(item.url)}
                  style={{
                    aspectRatio: '1', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  {item.type === 'image' ? (
                    <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && (activeTab === 'files' || activeTab === 'audio' || activeTab === 'links') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map(item => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                    textDecoration: 'none', color: 'var(--mc-text)',
                    border: '1px solid var(--mc-border)',
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(var(--mc-blue-rgb, 29,78,216), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {activeTab === 'audio' ? <Music size={16} style={{ color: 'var(--mc-blue)' }} /> :
                     activeTab === 'links' ? <LinkIcon size={16} style={{ color: 'var(--mc-blue)' }} /> :
                     <FileText size={16} style={{ color: 'var(--mc-blue)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.fileName || item.url}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--mc-text-muted)' }}>
                      {item.senderName} · {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedMediaPanel;