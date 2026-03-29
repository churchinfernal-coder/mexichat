import React, { useState, useRef, useCallback } from "react";
import { X, Image, Send, Loader2 } from "lucide-react";
import { useContentCreation } from "@/hooks/useContentCreation";

interface Props { open: boolean; onClose: () => void; onSuccess?: () => void; }
const MAX_FILES = 10;

const CreatePostModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { submitPost, loading, error, progress } = useContentCreation();
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => f.size <= 20 * 1024 * 1024);
    const combined = [...files, ...valid].slice(0, MAX_FILES);
    setFiles(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }, [files]);

  const removeFile = useCallback((idx: number) => {
    setFiles((f) => f.filter((_, i) => i !== idx));
    setPreviews((p) => { URL.revokeObjectURL(p[idx]); return p.filter((_, i) => i !== idx); });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!caption.trim() && files.length === 0) return;
    try {
      await submitPost({ caption, files });
      setCaption(""); setFiles([]); setPreviews([]);
      onSuccess?.(); onClose();
    } catch {}
  }, [caption, files, submitPost, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18} className="text-gray-600" /></button>
          <h2 className="text-base font-bold text-gray-900">Nueva Publicación</h2>
          <button onClick={handleSubmit} disabled={loading || (!caption.trim() && files.length === 0)}
            className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Publicar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="?Qué está pasando?" maxLength={2000}
            className="w-full resize-none text-base text-gray-900 placeholder-gray-400 outline-none min-h-[120px] bg-transparent" autoFocus />
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  {files[i]?.type.startsWith("video/") ? (
                    <video src={src} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  )}
                  <button onClick={() => removeFile(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {loading && <p className="text-sm text-blue-500 mt-3 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {progress}</p>}
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFiles} />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
            <Image size={14} /> Foto/Video
          </button>
          <span className="ml-auto text-xs text-gray-400">{files.length}/{MAX_FILES} archivos</span>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;