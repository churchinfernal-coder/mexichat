import React, { useState, useEffect } from 'react';
import { Link2, Copy, Trash2, Clock, Users, RefreshCw, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { GroupInvite } from '@/hooks/useGroupInvites';

export interface GroupInviteModalProps {
  open: boolean;
  groupId: string;
  groupName: string;
  invites: GroupInvite[];
  loading: boolean;
  onGenerateLink: (groupId: string, options?: { expiresInHours?: number; maxUses?: number }) => Promise<string | null>;
  onRevokeInvite: (inviteId: string) => Promise<void>;
  onRevokeAll: (groupId: string) => Promise<void>;
  onLoadInvites: (groupId: string) => Promise<void>;
  onClose: () => void;
}

const GroupInviteModal: React.FC<GroupInviteModalProps> = ({
  open, groupId, groupName, invites, loading,
  onGenerateLink, onRevokeInvite, onRevokeAll, onLoadInvites, onClose,
}) => {
  const [expiresIn, setExpiresIn] = useState<number>(0); // 0 = never
  const [maxUses, setMaxUses] = useState<number>(0); // 0 = unlimited
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  useEffect(() => {
    if (open && groupId) onLoadInvites(groupId);
  }, [open, groupId, onLoadInvites]);

  if (!open) return null;

  const handleGenerate = async () => {
    const opts: { expiresInHours?: number; maxUses?: number } = {};
    if (expiresIn > 0) opts.expiresInHours = expiresIn;
    if (maxUses > 0) opts.maxUses = maxUses;
    const link = await onGenerateLink(groupId, opts);
    if (link) setGeneratedLink(link);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Enlace copiado'));
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Sin expiración';
    const d = new Date(expiresAt);
    if (d < new Date()) return 'Expirado';
    const hours = Math.round((d.getTime() - Date.now()) / 3600000);
    if (hours < 1) return 'Expira pronto';
    if (hours < 24) return `Expira en ${hours}h`;
    return `Expira en ${Math.round(hours / 24)}d`;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--mc-border)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mc-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--mc-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={18} /> Invitar a {groupName}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}>
            <XIcon size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Generate new link */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mc-text)', marginBottom: '12px' }}>Crear nuevo enlace</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--mc-text-muted)', display: 'block', marginBottom: '4px' }}>Expiración</label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '6px', color: 'var(--mc-text)', fontSize: '13px' }}
                >
                  <option value={0}>Sin expiración</option>
                  <option value={1}>1 hora</option>
                  <option value={24}>24 horas</option>
                  <option value={168}>7 días</option>
                  <option value={720}>30 días</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--mc-text-muted)', display: 'block', marginBottom: '4px' }}>Usos máximos</label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '6px', color: 'var(--mc-text)', fontSize: '13px' }}
                >
                  <option value={0}>Ilimitado</option>
                  <option value={1}>1 uso</option>
                  <option value={5}>5 usos</option>
                  <option value={10}>10 usos</option>
                  <option value={25}>25 usos</option>
                  <option value={50}>50 usos</option>
                  <option value={100}>100 usos</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: 'var(--mc-blue)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '14px', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Link2 size={14} />}
              Generar Enlace
            </button>
          </div>

          {/* Generated link display */}
          {generatedLink && (
            <div style={{ padding: '12px', background: 'rgba(var(--mc-blue-rgb, 220,38,38), 0.1)', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(var(--mc-blue-rgb, 220,38,38), 0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--mc-text-muted)', marginBottom: '6px' }}>Enlace generado:</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  readOnly
                  value={generatedLink}
                  style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '6px', color: 'var(--mc-text)', fontSize: '12px', fontFamily: 'monospace' }}
                />
                <button
                  onClick={() => handleCopy(generatedLink)}
                  style={{ padding: '8px', background: 'var(--mc-blue)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Copiar"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Active invites list */}
          {invites.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mc-text)' }}>Enlaces activos ({invites.length})</span>
                <button
                  onClick={() => onRevokeAll(groupId)}
                  style={{ fontSize: '11px', color: 'var(--mc-blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Revocar todos
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invites.map((inv) => {
                  const link = `${window.location.origin}/invite/${inv.inviteCode}`;
                  return (
                    <div key={inv.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--mc-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <code style={{ flex: 1, fontSize: '11px', color: 'var(--mc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {link}
                        </code>
                        <button onClick={() => handleCopy(link)} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '2px' }}>
                          <Copy size={12} />
                        </button>
                        <button onClick={() => onRevokeInvite(inv.id)} style={{ background: 'none', border: 'none', color: 'var(--mc-blue)', cursor: 'pointer', padding: '2px' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--mc-text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={10} /> {formatExpiry(inv.expiresAt)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Users size={10} /> {inv.useCount}{inv.maxUses ? `/${inv.maxUses}` : ''} usos
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default GroupInviteModal;