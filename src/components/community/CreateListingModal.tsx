import React, { useState, useRef, useCallback } from "react";
import { X, Camera, DollarSign, MapPin, Send, Loader2, ShoppingBag } from "lucide-react";
import { useContentCreation } from "@/hooks/useContentCreation";

interface Props { open: boolean; onClose: () => void; onSuccess?: () => void; }
const CATEGORIES = ["Electrónica","Ropa","Hogar","Vehículos","Deportes","Libros","Juguetes","Herramientas","Mascotas","Otro"];
const CONDITIONS: {value:string;label:string}[] = [{value:"new",label:"Nuevo"},{value:"like_new",label:"Como nuevo"},{value:"good",label:"Buen estado"},{value:"fair",label:"Aceptable"},{value:"used",label:"Usado"}];

const CreateListingModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { submitListing, loading, error, progress } = useContentCreation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("good");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const combined = [...files, ...selected].slice(0, 8);
    setFiles(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }, [files]);

  const removeFile = useCallback((idx: number) => {
    setFiles((f) => f.filter((_, i) => i !== idx));
    setPreviews((p) => { URL.revokeObjectURL(p[idx]); return p.filter((_, i) => i !== idx); });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !price) return;
    try {
      await submitListing({ title, description, price: parseFloat(price), category: category || "Otro", condition: condition as any, location, files });
      setTitle(""); setDescription(""); setPrice(""); setCategory(""); setCondition("good"); setLocation(""); setFiles([]); setPreviews([]);
      onSuccess?.(); onClose();
    } catch {}
  }, [title, description, price, category, condition, location, files, submitListing, onSuccess, onClose]);

  if (!open) return null;
  const IS = "w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18} className="text-gray-600" /></button>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5"><ShoppingBag size={16} className="text-emerald-500" /> Vender Artículo</h2>
          <button onClick={handleSubmit} disabled={loading || !title.trim() || !price}
            className="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publicar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Fotos (hasta 8)</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {previews.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeFile(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"><X size={10} className="text-white" /></button>
                </div>
              ))}
              {files.length < 8 && (
                <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 flex-shrink-0">
                  <Camera size={20} /><span className="text-[10px] mt-0.5">Agregar</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
          </div>
          <input className={IS} placeholder="Título del artículo *" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          <div className="relative">
            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={IS + " pl-8"} placeholder="Precio (MXN) *" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <select className={IS} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Categoría</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-1.5 flex-wrap">
            {CONDITIONS.map((c) => (
              <button key={c.value} onClick={() => setCondition(c.value)}
                className={"px-3 py-1.5 rounded-full text-xs font-medium transition-colors " + (condition === c.value ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600")}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={IS + " pl-8"} placeholder="Ubicación (opcional)" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <textarea className={IS + " min-h-[80px] resize-none"} placeholder="Descripción..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          {loading && <p className="text-sm text-emerald-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {progress}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default CreateListingModal;