import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cropToSquare } from '@/utils/imageCompression';
import { toast } from 'sonner';

interface AvatarUploaderProps {
  currentUrl: string | null;
  onUpload: (url: string) => void;
  bucket?: string;
  path: string;
  size?: number;
  shape?: 'circle' | 'rounded';
}

const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  currentUrl, onUpload, bucket = 'avatars', path, size = 200, shape = 'circle',
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) { toast.error('Solo imagenes'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }

    setUploading(true);
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      const cropped = await cropToSquare(file, size);
      const fileName = `${path}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from(bucket).upload(fileName, cropped, { cacheControl: '3600', upsert: true });
      if (error) throw error;

      const { data } = await supabase.storage.from(bucket).createSignedUrl(fileName, 60 * 60 * 24 * 365);
      if (data?.signedUrl) onUpload(data.signedUrl);
      else throw new Error('No signed URL');
    } catch {
      toast.error('Error al subir avatar');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setPreview(null);
      setUploading(false);
    }
  };

  const displayUrl = preview || currentUrl;
  const borderRadius = shape === 'circle' ? '50%' : '12px';

  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
      <div style={{
        width: '100%', height: '100%', borderRadius, overflow: 'hidden',
        background: 'var(--mc-sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px solid var(--mc-border)',
      }}>
        {displayUrl ? (
          <img src={displayUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: uploading ? 0.5 : 1 }} />
        ) : (
          <Camera size={size * 0.3} style={{ color: 'var(--mc-text-muted)' }} />
        )}
      </div>
      <div style={{
        position: 'absolute', bottom: 0, right: 0, width: '32px', height: '32px', borderRadius: '50%',
        background: 'var(--mc-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px solid var(--mc-sidebar)',
      }}>
        <Camera size={14} style={{ color: 'white' }} />
      </div>
      {uploading && (
        <div style={{ position: 'absolute', inset: 0, borderRadius, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ width: '24px', height: '24px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSelect} />
    </div>
  );
};

export default AvatarUploader;