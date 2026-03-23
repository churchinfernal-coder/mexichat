import React, { useState, useRef, useCallback } from "react";
import { X, Video, Image, Send, Loader2 } from "lucide-react";
import { useContentCreation } from "@/hooks/useContentCreation";

interface Props { open: boolean; onClose: () => void; onSuccess?: () => void; }

const CreateVideoModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { submitVideo, loading, error, progress } = useContentCreation();
  const [caption, setCaption] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const handleVideo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { alert("Video maximo 100MB"); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    e.target.value = "";
  }, []);

  const handleThumb = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
    e.target.value = "";
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!videoFile) return;
    try {
      await submitVideo({ caption, videoFile, thumbnailFile: thumbFile || undefined });
      setCaption(""); setVideoFile(null); setVideoPreview(null); setThumbFile(null); setThumbPreview(null);
      onSuccess?.(); onClose();
    } catch {}
  }, [caption, videoFile, thumbFile, submitVideo, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18} className="text-gray-600" /></button>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5"><Video size={16} className="text-purple-500" /> Subir Video</h2>
          <button onClick={handleSubmit} disabled={loading || !videoFile}
            className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Subir
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Video *</label>
            {videoPreview ? (
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video src={videoPreview} className="w-full max-h-[200px] object-contain" controls muted />
                <button onClick={() => { setVideoFile(null); setVideoPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => videoInputRef.current?.click()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 flex flex-col items-center justify-center text-purple-400 gap-1">
                <Video size={28} />
                <span className="text-sm font-medium">Seleccionar video</span>
                <span className="text-[10px]">Maximo 100MB</span>
              </button>
            )}
            <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={handleVideo} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Portada (opcional)</label>
            {thumbPreview ? (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                <img src={thumbPreview} alt="" className="w-full h-full object-cover" />
                <button onClick={() => { setThumbFile(null); setThumbPreview(null); }} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                  <X size={10} className="text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => thumbInputRef.current?.click()}
                className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                <Image size={18} /><span className="text-[10px] mt-0.5">Portada</span>
              </button>
            )}
            <input ref={thumbInputRef} type="file" accept="image/*" hidden onChange={handleThumb} />
          </div>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Escribe una descripcion... #hashtags" maxLength={500}
            className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-purple-400 resize-none min-h-[80px]" />
          {loading && <p className="text-sm text-purple-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {progress}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default CreateVideoModal;