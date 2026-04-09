/**
 * MEXICHAT — ReminderModal + ReminderAlert
 * Create reminders with calendar picker + time input.
 * Alert popup when reminder fires.
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Bell, BellRing, X, RotateCcw, Trash2, Repeat, AlarmClock } from 'lucide-react';
import type { Reminder } from '@/hooks/useReminders';

// ═══════════════════════════════════════
// REMINDER CREATOR MODAL
// ═══════════════════════════════════════

interface ReminderModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (opts: {
    title: string;
    note?: string;
    remindAt: Date;
    repeatMode?: 'none' | 'daily' | 'weekly' | 'monthly';
  }) => void;
  chatName?: string;
}

const quickOptions = [
  { label: '15 min', minutes: 15, emoji: '⏱️' },
  { label: '30 min', minutes: 30, emoji: '🕐' },
  { label: '1 hora', minutes: 60, emoji: '🕑' },
  { label: '3 horas', minutes: 180, emoji: '🕒' },
  { label: 'Manana 9am', minutes: -1, emoji: '🌅' },
  { label: 'Lunes 9am', minutes: -2, emoji: '📅' },
];

function getNextMondayAt9(): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  d.setDate(d.getDate() + daysUntilMon);
  d.setHours(9, 0, 0, 0);
  return d;
}

function getTomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({ open, onClose, onCreate, chatName }) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [repeatMode, setRepeatMode] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(chatName ? `Responder a ${chatName}` : '');
      setNote('');
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      setDateStr(now.toISOString().split('T')[0]);
      setTimeStr(now.toTimeString().slice(0, 5));
      setRepeatMode('none');
      setShowCustom(false);
    }
  }, [open, chatName]);

  if (!open) return null;

  const handleQuick = (minutes: number) => {
    let remindAt: Date;
    if (minutes === -1) remindAt = getTomorrowAt9();
    else if (minutes === -2) remindAt = getNextMondayAt9();
    else remindAt = new Date(Date.now() + minutes * 60000);
    if (!title.trim()) { setTitle(chatName ? `Responder a ${chatName}` : 'Recordatorio'); }
    onCreate({ title: title.trim() || (chatName ? `Responder a ${chatName}` : 'Recordatorio'), note: note || undefined, remindAt, repeatMode });
    onClose();
  };

  const handleCustomSubmit = () => {
    if (!dateStr || !timeStr) return;
    const remindAt = new Date(`${dateStr}T${timeStr}:00`);
    if (remindAt.getTime() <= Date.now()) { return; }
    onCreate({ title: title.trim() || 'Recordatorio', note: note || undefined, remindAt, repeatMode });
    onClose();
  };

  const MC = {
    overlay: 'rgba(0,0,0,0.45)', bg: '#ffffff', border: '#e2e8f0',
    text: '#0f172a', muted: '#94a3b8', blue: '#1d4ed8', inputBg: '#f1f5f9',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: MC.overlay, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: MC.bg, borderRadius: '16px', width: '100%', maxWidth: '400px', maxHeight: '85vh', overflow: 'auto', border: `1px solid ${MC.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${MC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlarmClock size={20} style={{ color: MC.blue }} />
            <span style={{ fontWeight: 700, fontSize: '16px', color: MC.text }}>Nuevo Recordatorio</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MC.muted, cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: '13px', color: MC.muted, marginBottom: '6px', display: 'block' }}>Titulo</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Responder mensaje"
              style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Note */}
          <div>
            <label style={{ fontSize: '13px', color: MC.muted, marginBottom: '6px', display: 'block' }}>Nota (opcional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalles adicionales..."
              rows={2} style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Quick options */}
          <div>
            <label style={{ fontSize: '13px', color: MC.muted, marginBottom: '8px', display: 'block' }}>Acceso rapido</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {quickOptions.map((opt) => (
                <button key={opt.label} onClick={() => handleQuick(opt.minutes)}
                  style={{
                    padding: '10px 8px', background: MC.inputBg, border: `1px solid ${MC.border}`,
                    borderRadius: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '4px', transition: 'all 0.15s', fontSize: '12px',
                    color: MC.text, fontWeight: 600,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(29,78,216,0.08)'; e.currentTarget.style.borderColor = MC.blue; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = MC.inputBg; e.currentTarget.style.borderColor = MC.border; }}
                >
                  <span style={{ fontSize: '18px' }}>{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date/time toggle */}
          <button onClick={() => setShowCustom(!showCustom)}
            style={{
              padding: '10px', background: showCustom ? 'rgba(29,78,216,0.08)' : MC.inputBg,
              border: `1px solid ${showCustom ? MC.blue : MC.border}`, borderRadius: '10px',
              cursor: 'pointer', color: showCustom ? MC.blue : MC.text, fontWeight: 600,
              fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
            <Calendar size={16} /> Fecha y hora personalizada
          </button>

          {showCustom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: MC.inputBg, borderRadius: '12px', border: `1px solid ${MC.border}` }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: MC.muted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> Fecha
                  </label>
                  <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '8px 10px', background: '#fff', border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: MC.muted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> Hora
                  </label>
                  <input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#fff', border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Repeat mode */}
              <div>
                <label style={{ fontSize: '12px', color: MC.muted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Repeat size={12} /> Repetir
                </label>
                <select value={repeatMode} onChange={(e) => setRepeatMode(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', background: '#fff', border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="none">No repetir</option>
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              <button onClick={handleCustomSubmit}
                style={{ padding: '10px', background: MC.blue, border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                Crear Recordatorio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// REMINDER ALERT POPUP (fires when due)
// ═══════════════════════════════════════

interface ReminderAlertProps {
  reminder: Reminder | null;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, minutes?: number) => void;
  onGoToChat?: (conversationId?: string | null, groupId?: string | null) => void;
}

export const ReminderAlert: React.FC<ReminderAlertProps> = ({ reminder, onDismiss, onSnooze, onGoToChat }) => {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    if (reminder) {
      setPulse(true);
      const t = setInterval(() => setPulse(p => !p), 600);
      return () => clearInterval(t);
    }
  }, [reminder]);

  if (!reminder) return null;

  const timeStr = new Date(reminder.remindAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 200, width: '100%', maxWidth: '380px', padding: '0 16px',
      animation: 'slideDown 0.4s ease',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
        borderRadius: '16px', padding: '18px 20px',
        boxShadow: '0 12px 40px rgba(29,78,216,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
        color: 'white',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            animation: pulse ? 'none' : 'none',
            transform: pulse ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.3s',
          }}>
            <BellRing size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {reminder.title}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {timeStr} • Recordatorio
            </div>
          </div>
          <button onClick={() => onDismiss(reminder.id)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        {/* Note */}
        {reminder.note && (
          <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '12px', padding: '8px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
            {reminder.note}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(reminder.conversationId || reminder.groupId) && onGoToChat && (
            <button onClick={() => { onGoToChat(reminder.conversationId, reminder.groupId); onDismiss(reminder.id); }}
              style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '8px', color: '#1d4ed8', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              Ir al chat
            </button>
          )}
          <button onClick={() => onSnooze(reminder.id, 10)}
            style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <RotateCcw size={13} /> +10 min
          </button>
          <button onClick={() => onDismiss(reminder.id)}
            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            OK
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-30px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════
// REMINDER LIST (for settings/sidebar)
// ═══════════════════════════════════════

interface ReminderListProps {
  reminders: Reminder[];
  onDelete: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const ReminderList: React.FC<ReminderListProps> = ({ reminders, onDelete, onDismiss }) => {
  const upcoming = reminders.filter(r => !r.isFired && !r.isDismissed);
  const past = reminders.filter(r => r.isFired && !r.isDismissed);

  const MC = { text: '#0f172a', muted: '#94a3b8', blue: '#1d4ed8', border: '#e2e8f0', inputBg: '#f1f5f9', danger: '#ef4444' };

  if (reminders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 20px', color: MC.muted }}>
        <Bell size={32} style={{ opacity: 0.4, marginBottom: '10px' }} />
        <div style={{ fontSize: '14px', fontWeight: 600 }}>Sin recordatorios</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>Crea uno desde el menu de acciones del chat</div>
      </div>
    );
  }

  const formatRemindAt = (dt: string) => {
    const d = new Date(dt);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 0) return 'Vencido';
    if (mins < 60) return `En ${mins} min`;
    if (mins < 1440) return `Hoy ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const repeatLabels: Record<string, string> = { none: '', daily: '🔁 Diario', weekly: '🔁 Semanal', monthly: '🔁 Mensual' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {upcoming.length > 0 && (
        <div style={{ fontSize: '11px', fontWeight: 700, color: MC.blue, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Proximos ({upcoming.length})
        </div>
      )}
      {upcoming.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: MC.inputBg, borderRadius: '10px', border: `1px solid ${MC.border}` }}>
          <Bell size={16} style={{ color: MC.blue, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: MC.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
            <div style={{ fontSize: '11px', color: MC.muted, display: 'flex', gap: '8px' }}>
              <span>{formatRemindAt(r.remindAt)}</span>
              {r.repeatMode !== 'none' && <span>{repeatLabels[r.repeatMode]}</span>}
            </div>
          </div>
          <button onClick={() => onDelete(r.id)} style={{ background: 'none', border: 'none', color: MC.danger, cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
        </div>
      ))}
      {past.length > 0 && (
        <>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MC.muted, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>
            Pasados ({past.length})
          </div>
          {past.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: MC.inputBg, borderRadius: '10px', opacity: 0.6 }}>
              <Bell size={14} style={{ color: MC.muted, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: MC.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
              </div>
              <button onClick={() => onDismiss(r.id)} style={{ background: 'none', border: 'none', color: MC.muted, cursor: 'pointer', padding: '4px', fontSize: '11px' }}>Limpiar</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
};