import React, { useState } from 'react';
import { X, AlertTriangle, Shield, Upload, Camera } from 'lucide-react';

// Carrier-grade report categories with severity levels
var CATEGORIES = [
  // CRITICAL (auto-escalate, immediate review)
  { id: 'csam', label: 'Explotacion de menores (CSAM)', severity: 'critical', icon: '🚨' },
  { id: 'extortion', label: 'Extorsion / Chantaje', severity: 'critical', icon: '⚠️' },
  { id: 'terrorism', label: 'Terrorismo / Amenaza de violencia', severity: 'critical', icon: '🔴' },
  { id: 'human_trafficking', label: 'Trata de personas', severity: 'critical', icon: '🚨' },
  { id: 'self_harm', label: 'Autolesion / Suicidio', severity: 'critical', icon: '🆘' },
  // HIGH
  { id: 'fraud', label: 'Fraude / Estafa financiera', severity: 'high', icon: '💰' },
  { id: 'identity_theft', label: 'Suplantacion de identidad', severity: 'high', icon: '🎭' },
  { id: 'doxxing', label: 'Doxxing / Datos personales expuestos', severity: 'high', icon: '📋' },
  { id: 'revenge_porn', label: 'Pornografia no consentida', severity: 'high', icon: '🔞' },
  { id: 'drug_sales', label: 'Venta de drogas / Sustancias ilegales', severity: 'high', icon: '💊' },
  { id: 'weapons', label: 'Venta de armas', severity: 'high', icon: '🔫' },
  // MEDIUM
  { id: 'harassment', label: 'Acoso / Bullying', severity: 'medium', icon: '😡' },
  { id: 'hate_speech', label: 'Discurso de odio / Discriminacion', severity: 'medium', icon: '🚫' },
  { id: 'threats', label: 'Amenazas personales', severity: 'medium', icon: '⚡' },
  { id: 'underage', label: 'Menor de edad en la plataforma', severity: 'medium', icon: '👶' },
  { id: 'sexual_harassment', label: 'Acoso sexual', severity: 'medium', icon: '🛑' },
  // LOW
  { id: 'spam', label: 'Spam / Publicidad no deseada', severity: 'low', icon: '📧' },
  { id: 'fake_profile', label: 'Perfil falso', severity: 'low', icon: '👤' },
  { id: 'inappropriate', label: 'Contenido inapropiado', severity: 'low', icon: '🔶' },
  { id: 'other', label: 'Otro', severity: 'low', icon: '📝' },
];

var SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICO - Revision inmediata', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  high:     { label: 'ALTO - Revision prioritaria', color: '#ea580c', bg: 'rgba(234,88,12,0.12)' },
  medium:   { label: 'MEDIO', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  low:      { label: 'BAJO', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

interface ReportDialogProps {
  open: boolean;
  userName: string;
  onSubmit: (category: string, reason: string, severity: string, evidenceUrls: string[]) => void;
  onCancel: () => void;
  // Optional: for message-level reports
  messageContent?: string;
  messageId?: string;
  // Optional: for group reports
  groupName?: string;
}

var ReportDialog: React.FC<ReportDialogProps> = function(props) {
  var open = props.open, userName = props.userName, onSubmit = props.onSubmit, onCancel = props.onCancel;
  var messageContent = props.messageContent, messageId = props.messageId, groupName = props.groupName;

  var _cat = useState(''), category = _cat[0], setCategory = _cat[1];
  var _reason = useState(''), reason = _reason[0], setReason = _reason[1];
  var _evidence = useState<string[]>([]), evidenceUrls = _evidence[0], setEvidenceUrls = _evidence[1];
  var _uploading = useState(false), uploading = _uploading[0], setUploading = _uploading[1];
  var _section = useState<'critical' | 'high' | 'medium' | 'low' | null>(null), activeSection = _section[0], setActiveSection = _section[1];

  if (!open) return null;

  var selectedCat = CATEGORIES.find(function(c) { return c.id === category; });
  var severity = selectedCat ? selectedCat.severity : '';

  function handleSubmit() {
    if (!category) return;
    onSubmit(category, reason, severity, evidenceUrls);
    setCategory('');
    setReason('');
    setEvidenceUrls([]);
    setActiveSection(null);
  }

  function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { return; }
    setUploading(true);
    // Convert to base64 data URL for evidence
    var reader = new FileReader();
    reader.onload = function() {
      if (reader.result) {
        setEvidenceUrls(function(prev) { return prev.concat([reader.result as string]); });
      }
      setUploading(false);
    };
    reader.onerror = function() { setUploading(false); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  var groupedCategories: Record<string, typeof CATEGORIES> = {};
  CATEGORIES.forEach(function(c) {
    if (!groupedCategories[c.severity]) groupedCategories[c.severity] = [];
    groupedCategories[c.severity].push(c);
  });

  var targetLabel = groupName ? 'grupo ' + groupName : userName;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={function(e: React.MouseEvent) { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: 'var(--mc-sidebar, #ffffff)', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--mc-border, #e2e8f0)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--mc-border, #e2e8f0)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--mc-text, #0f172a)' }}>Reportar a {targetLabel}</h3>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--mc-text-muted, #94a3b8)' }}>Los reportes criticos se escalan inmediatamente</p>
              </div>
            </div>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted, #94a3b8)', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* Message evidence if reporting a specific message */}
          {messageContent && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mensaje reportado</div>
              <div style={{ fontSize: '13px', color: 'var(--mc-text, #0f172a)', fontStyle: 'italic', wordBreak: 'break-word' }}>"{messageContent.length > 200 ? messageContent.slice(0, 200) + '...' : messageContent}"</div>
            </div>
          )}

          {/* Severity sections */}
          {(['critical', 'high', 'medium', 'low'] as const).map(function(sev) {
            var sevCfg = SEVERITY_CONFIG[sev];
            var cats = groupedCategories[sev] || [];
            var isOpen = activeSection === sev;
            return (
              <div key={sev} style={{ marginBottom: '8px' }}>
                <button onClick={function() { setActiveSection(isOpen ? null : sev); }}
                  style={{ width: '100%', padding: '10px 14px', background: isOpen ? sevCfg.bg : 'transparent', border: '1px solid ' + (isOpen ? sevCfg.color : 'var(--mc-border, #e2e8f0)'), borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--mc-text, #0f172a)', fontSize: '13px', fontWeight: 600 }}>
                  <span><span style={{ color: sevCfg.color }}>{sevCfg.label}</span> <span style={{ fontWeight: 400, color: 'var(--mc-text-muted, #94a3b8)' }}>({cats.length})</span></span>
                  <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--mc-text-muted, #94a3b8)' }}>▼</span>
                </button>
                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0 0 0' }}>
                    {cats.map(function(c) {
                      var isSelected = category === c.id;
                      return (
                        <button key={c.id} onClick={function() { setCategory(c.id); }}
                          style={{
                            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                            background: isSelected ? sevCfg.bg : 'var(--mc-input-bg, #f1f5f9)',
                            border: isSelected ? '2px solid ' + sevCfg.color : '1px solid var(--mc-border, #e2e8f0)',
                            borderRadius: '8px', color: 'var(--mc-text, #0f172a)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', width: '100%',
                            fontWeight: isSelected ? 600 : 400,
                          }}>
                          <span style={{ fontSize: '16px', flexShrink: 0 }}>{c.icon}</span>
                          <span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Severity warning for critical reports */}
          {severity === 'critical' && (
            <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', margin: '12px 0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>⚠️ REPORTE CRITICO</div>
              <div style={{ fontSize: '12px', color: 'var(--mc-text, #0f172a)' }}>
                Este reporte sera escalado inmediatamente al equipo de seguridad. El usuario sera bloqueado de forma preventiva. Si la situacion es una emergencia, contacta a las autoridades locales al 911.
              </div>
            </div>
          )}

          {/* Details textarea */}
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mc-text-muted, #94a3b8)', display: 'block', marginBottom: '6px' }}>Detalles del reporte {severity === 'critical' || severity === 'high' ? '(requerido)' : '(opcional)'}</label>
            <textarea value={reason} onChange={function(e) { setReason(e.target.value); }} rows={3}
              placeholder="Describe lo que sucedio con el mayor detalle posible..."
              style={{ width: '100%', padding: '10px 14px', background: 'var(--mc-input-bg, #f1f5f9)', border: '1px solid var(--mc-border, #e2e8f0)', borderRadius: '8px', color: 'var(--mc-text, #0f172a)', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
          </div>

          {/* Evidence upload */}
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mc-text-muted, #94a3b8)', display: 'block', marginBottom: '6px' }}>Evidencia (capturas de pantalla)</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {evidenceUrls.map(function(url, i) {
                return (
                  <div key={i} style={{ width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--mc-border, #e2e8f0)', position: 'relative' }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={function() { setEvidenceUrls(function(prev) { return prev.filter(function(_, idx) { return idx !== i; }); }); }}
                      style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                  </div>
                );
              })}
              {evidenceUrls.length < 5 && (
                <label style={{ width: '64px', height: '64px', borderRadius: '8px', border: '2px dashed var(--mc-border, #e2e8f0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', gap: '2px' }}>
                  <Camera size={16} style={{ color: 'var(--mc-text-muted, #94a3b8)' }} />
                  <span style={{ fontSize: '9px', color: 'var(--mc-text-muted, #94a3b8)' }}>{uploading ? '...' : 'Subir'}</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScreenshotUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--mc-border, #e2e8f0)', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', background: 'var(--mc-input-bg, #f1f5f9)', border: '1px solid var(--mc-border, #e2e8f0)', borderRadius: '8px', color: 'var(--mc-text, #0f172a)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={!category || ((severity === 'critical' || severity === 'high') && !reason.trim())}
            style={{
              padding: '10px 20px',
              background: category ? (severity === 'critical' ? '#dc2626' : '#ef4444') : '#94a3b8',
              border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 700,
              cursor: category && !((severity === 'critical' || severity === 'high') && !reason.trim()) ? 'pointer' : 'not-allowed',
              opacity: category && !((severity === 'critical' || severity === 'high') && !reason.trim()) ? 1 : 0.5,
            }}>
            {severity === 'critical' ? '🚨 Reportar y Bloquear Inmediatamente' : 'Reportar y Bloquear'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportDialog;