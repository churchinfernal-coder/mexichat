import React from 'react';
import { useTranslation, type Language } from '@/i18n';
import { Globe } from 'lucide-react';

const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: 'es', flag: '🇲🇽', label: 'Español' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
];

interface LanguageToggleProps {
  variant?: 'dropdown' | 'pills' | 'compact';
  className?: string;
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({ variant = 'pills', className = '' }) => {
  const { lang, setLang } = useTranslation();

  if (variant === 'compact') {
    return (
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Language)}
        className={className}
        style={{
          padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
          background: 'white', fontSize: '13px', cursor: 'pointer', color: '#0f172a',
        }}
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
        ))}
      </select>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }} className={className}>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
          style={{
            padding: '8px 32px 8px 12px', borderRadius: '8px',
            border: '1px solid #334155', background: 'rgba(255,255,255,0.06)',
            fontSize: '13px', cursor: 'pointer', color: '#e2e8f0',
            appearance: 'none', WebkitAppearance: 'none',
          }}
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code} style={{ background: '#1e293b', color: '#e2e8f0' }}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        <Globe size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
      </div>
    );
  }

  // Pills variant (default)
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }} className={className}>
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          style={{
            padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
            background: lang === l.code ? '#3b82f6' : 'rgba(255,255,255,0.08)',
            color: lang === l.code ? 'white' : '#94a3b8',
          }}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageToggle;