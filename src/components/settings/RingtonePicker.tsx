/**
 * MEXICHAT — Ringtone Picker Component
 * Lets user preview and select from 6 ringtones.
 * Selection saved to localStorage, used by startRingtone().
 */

import React, { useState, useEffect } from 'react';
import { Music, Play, Square, Check } from 'lucide-react';
import {
  RINGTONES,
  getSelectedRingtone,
  setSelectedRingtone,
  previewRingtone,
  stopPreview,
} from '@/utils/sounds';

interface RingtonePickerProps {
  lang?: 'es' | 'en' | 'ru' | 'zh';
  onClose?: () => void;
}

const RingtonePicker: React.FC<RingtonePickerProps> = ({ lang = 'es', onClose }) => {
  const [selected, setSelected] = useState(getSelectedRingtone());
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    return () => { stopPreview(); };
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);
    setSelectedRingtone(id);
  };

  const handlePreview = (id: string) => {
    if (playing === id) {
      stopPreview();
      setPlaying(null);
    } else {
      stopPreview();
      previewRingtone(id);
      setPlaying(id);
      // Auto-stop after 4 seconds
      setTimeout(() => {
        stopPreview();
        setPlaying(null);
      }, 4000);
    }
  };

  const labels = {
    es: { title: 'Tono de llamada', subtitle: 'Elige tu tono de llamada entrante' },
    en: { title: 'Ringtone', subtitle: 'Choose your incoming call ringtone' },
    ru: { title: 'Рингтон', subtitle: 'Выберите мелодию входящего звонка' },
    zh: { title: '铃声', subtitle: '选择来电铃声' },
  };
  const l = labels[lang] || labels.es;

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', padding: '0 4px' }}>
        <Music size={18} style={{ color: '#3b82f6' }} />
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#111' }}>{l.title}</span>
      </div>
      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px', padding: '0 4px' }}>{l.subtitle}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {RINGTONES.map((rt) => {
          const isSelected = selected === rt.id;
          const isPlaying = playing === rt.id;
          const displayName = lang === 'es' ? rt.nameEs : rt.name;

          return (
            <div
              key={rt.id}
              onClick={() => handleSelect(rt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '12px',
                background: isSelected ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : '#f9fafb',
                border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Play/Stop button */}
              <button
                onClick={(e) => { e.stopPropagation(); handlePreview(rt.id); }}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isPlaying ? '#ef4444' : '#3b82f6',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.2s',
                }}
              >
                {isPlaying
                  ? <Square size={14} fill="white" color="white" />
                  : <Play size={14} fill="white" color="white" style={{ marginLeft: '2px' }} />
                }
              </button>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '14px', fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#1d4ed8' : '#374151',
                  margin: 0,
                }}>
                  {displayName}
                </p>
              </div>

              {/* Check mark */}
              {isSelected && (
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Check size={14} color="white" strokeWidth={3} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RingtonePicker;