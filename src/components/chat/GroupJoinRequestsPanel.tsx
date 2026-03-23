import React from 'react';
import { Check, X as XIcon, Clock, User } from 'lucide-react';
import type { PendingJoinRequest } from '@/hooks/useGroupInvites';

export interface GroupJoinRequestsPanelProps {
  requests: PendingJoinRequest[];
  onApprove: (requestId: string, userId: string, groupId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

const GroupJoinRequestsPanel: React.FC<GroupJoinRequestsPanelProps> = ({ requests, onApprove, onReject }) => {
  if (requests.length === 0) return null;

  return (
    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--mc-border)' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mc-text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Clock size={14} /> Solicitudes pendientes ({requests.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {requests.map((req) => (
          <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--mc-sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {req.userAvatar ? (
                <img src={req.userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={18} style={{ color: 'var(--mc-text-muted)' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mc-text)' }}>{req.userName}</div>
              <div style={{ fontSize: '11px', color: 'var(--mc-text-muted)' }}>
                {new Date(req.requestedAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => onApprove(req.id, req.userId, req.groupId)}
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#22c55e', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Aprobar"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => onReject(req.id)}
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--mc-blue)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Rechazar"
              >
                <XIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroupJoinRequestsPanel;