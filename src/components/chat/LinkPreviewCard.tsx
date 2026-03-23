import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { LinkPreviewData } from '@/hooks/useLinkPreview';

export interface LinkPreviewCardProps {
  url: string;
  preview: LinkPreviewData | null;
  onFetch: (url: string) => Promise<LinkPreviewData | null>;
}

const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ url, preview: initialPreview, onFetch }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(initialPreview);

  useEffect(() => {
    if (!initialPreview && url) {
      onFetch(url).then(p => { if (p) setPreview(p); });
    }
  }, [url, initialPreview, onFetch]);

  if (!preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', gap: '10px', padding: '10px', marginTop: '6px',
        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
        border: '1px solid var(--mc-border)', textDecoration: 'none', color: 'inherit',
        borderLeft: '3px solid var(--mc-blue)',
      }}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {preview.siteName && (
          <div style={{ fontSize: '11px', color: 'var(--mc-blue)', fontWeight: 600, marginBottom: '2px' }}>{preview.siteName}</div>
        )}
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview.title || preview.url}
        </div>
        {preview.description && preview.description !== preview.url && (
          <div style={{ fontSize: '12px', color: 'var(--mc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
            {preview.description}
          </div>
        )}
      </div>
      <ExternalLink size={12} style={{ color: 'var(--mc-text-muted)', flexShrink: 0, marginTop: '2px' }} />
    </a>
  );
};

export default LinkPreviewCard;