import React, { useState } from 'react';
import { X, Search, CornerUpRight } from 'lucide-react';
import type { ConversationItem, GroupItem } from '@/utils/messageMappers';

interface ForwardModalProps {
  open: boolean;
  messagePreview: string;
  conversations: ConversationItem[];
  groups: GroupItem[];
  currentConvId: string | null;
  onForwardToDm: (convId: string) => void;
  onForwardToGroup: (groupId: string) => void;
  onClose: () => void;
}

const ForwardModal: React.FC<ForwardModalProps> = ({
  open, messagePreview, conversations, groups, currentConvId,
  onForwardToDm, onForwardToGroup, onClose,
}) => {
  const [filter, setFilter] = useState('');
  if (!open) return null;

  const q = filter.toLowerCase();
  const filteredConvs = conversations.filter(c => c.id !== currentConvId && c.otherUserName.toLowerCase().includes(q));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(q));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '420px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--mc-border)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--mc-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerUpRight size={16} style={{ color: 'var(--mc-blue)' }} />
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--mc-text)' }}>Reenviar mensaje</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--mc-border)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: '12px', color: 'var(--mc-text-muted)', marginBottom: '4px' }}>Mensaje:</div>
          <div style={{ fontSize: '13px', color: 'var(--mc-text)', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{messagePreview}</div>
        </div>
        <div style={{ padding: '8px 16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mc-text-muted)' }} />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar..."
              style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--mc-border)', borderRadius: '8px', color: 'var(--mc-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {filteredConvs.length > 0 && <div style={{ fontSize: '11px', color: 'var(--mc-text-muted)', padding: '4px 12px', fontWeight: 600, textTransform: 'uppercase' }}>Chats</div>}
          {filteredConvs.map(c => (
            <div key={c.id} onClick={() => onForwardToDm(c.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--mc-sidebar-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--mc-sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                {c.otherUserAvatar ? <img src={c.otherUserAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.otherUserName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mc-text)' }}>{c.otherUserName}</span>
            </div>
          ))}
          {filteredGroups.length > 0 && <div style={{ fontSize: '11px', color: 'var(--mc-text-muted)', padding: '8px 12px 4px', fontWeight: 600, textTransform: 'uppercase' }}>Grupos</div>}
          {filteredGroups.map(g => (
            <div key={g.id} onClick={() => onForwardToGroup(g.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--mc-sidebar-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--mc-sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                {g.avatarUrl ? <img src={g.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : g.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mc-text)' }}>{g.name}</span>
            </div>
          ))}
          {filteredConvs.length === 0 && filteredGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--mc-text-muted)', fontSize: '13px' }}>Sin resultados</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;