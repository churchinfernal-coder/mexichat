/**
 * MEXICHAT - Inline Translate Button + Translation Display
 */
import React from 'react';
import { Languages, X } from 'lucide-react';
import type { TranslationResult } from '@/hooks/useAutoTranslate';

interface TranslateButtonProps {
  msgId: string;
  content: string;
  translation: TranslationResult | null;
  isTranslating: boolean;
  shouldOffer: boolean;
  onTranslate: (msgId: string, content: string) => void;
  onRemove: (msgId: string) => void;
}

const TranslateButton: React.FC<TranslateButtonProps> = ({
  msgId, content, translation, isTranslating, shouldOffer, onTranslate, onRemove,
}) => {
  if (translation) {
    return (
      <div style={{
        marginTop: '6px', padding: '6px 10px', background: 'rgba(29,78,216,0.06)',
        borderRadius: '6px', borderLeft: '2px solid #3b82f6', fontSize: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
          <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Traducido
          </span>
          <button onClick={() => onRemove(msgId)} style={{
            background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px',
          }}><X size={12} /></button>
        </div>
        <div style={{ color: 'var(--mc-text)', lineHeight: 1.4 }}>{translation.translatedText}</div>
      </div>
    );
  }
  if (!shouldOffer) return null;
  return (
    <button onClick={() => onTranslate(msgId, content)} disabled={isTranslating} style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px',
      padding: '2px 8px', background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.15)',
      borderRadius: '12px', cursor: 'pointer', fontSize: '11px', color: '#3b82f6', fontWeight: 600,
    }}>
      <Languages size={11} />
      {isTranslating ? 'Traduciendo...' : 'Traducir'}
    </button>
  );
};

export default TranslateButton;