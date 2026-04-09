import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  MessageCircle, Users, Search, Plus, UserPlus, Settings, ArrowLeft, ArrowRightLeft,
  Trash2, Paintbrush,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

export interface ConversationItem {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  otherUserOnline: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string;
}

export interface GroupItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  memberCount: number;
}

interface ChatSidebarProps {
  currentUser: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    username: string | null;
  };
  conversations: ConversationItem[];
  groups: GroupItem[];
  activeConversationId: string | null;
  activeTab: 'chats' | 'groups';
  onTabChange: (tab: 'chats' | 'groups') => void;
  onSelectConversation: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onOpenSettings?: () => void;
  onBack?: () => void;
  className?: string;
  onDeleteConversation?: (id: string) => void;
  onClearConversation?: (id: string) => void;
  onDeleteGroup?: (id: string) => void;
  onClearGroup?: (id: string) => void;
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Ayer';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// ════════════════════════════════════════════════════════════════
// SWIPEABLE ROW
// ════════════════════════════════════════════════════════════════

const SWIPE_THRESHOLD = 70;
const ACTION_WIDTH = 72;

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;   // Clear chat (brush)
  onSwipeRight?: () => void;  // Delete chat (trash)
  leftLabel?: string;
  rightLabel?: string;
}

const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children, onSwipeLeft, onSwipeRight,
  leftLabel = 'Limpiar', rightLabel = 'Eliminar',
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const direction = useRef<'none' | 'left' | 'right'>('none');
  const committed = useRef(false);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetPosition = useCallback(() => {
    setOffset(0);
    setIsDragging(false);
    swiping.current = false;
    direction.current = 'none';
    committed.current = false;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = startX.current;
    swiping.current = false;
    direction.current = 'none';
    committed.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // Determine direction on first significant move
    if (!swiping.current && !committed.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiping.current = true;
        setIsDragging(true);
      } else if (Math.abs(dy) > 10) {
        committed.current = true; // vertical scroll, ignore
        return;
      }
    }
    if (!swiping.current) return;

    e.preventDefault(); // prevent scroll while swiping

    currentX.current = touch.clientX;
    let newOffset = dx;

    // Only allow swipe left if onSwipeLeft exists, right if onSwipeRight
    if (newOffset > 0 && !onSwipeRight) newOffset = 0;
    if (newOffset < 0 && !onSwipeLeft) newOffset = 0;

    // Elastic resistance past threshold
    const max = ACTION_WIDTH + 20;
    if (Math.abs(newOffset) > max) {
      const over = Math.abs(newOffset) - max;
      newOffset = (newOffset > 0 ? 1 : -1) * (max + over * 0.2);
    }

    setOffset(newOffset);
  }, [onSwipeLeft, onSwipeRight]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping.current) { resetPosition(); return; }

    if (offset > SWIPE_THRESHOLD && onSwipeRight) {
      // Animate out then fire callback
      setOffset(ACTION_WIDTH);
      setTimeout(() => { resetPosition(); onSwipeRight(); }, 200);
    } else if (offset < -SWIPE_THRESHOLD && onSwipeLeft) {
      setOffset(-ACTION_WIDTH);
      setTimeout(() => { resetPosition(); onSwipeLeft(); }, 200);
    } else {
      resetPosition();
    }
  }, [offset, onSwipeLeft, onSwipeRight, resetPosition]);

  // Mouse support for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = e.clientX;
    swiping.current = false;
    direction.current = 'none';
    committed.current = false;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current;
      const dy = ev.clientY - startY.current;

      if (!swiping.current && !committed.current) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          swiping.current = true;
          setIsDragging(true);
        } else if (Math.abs(dy) > 8) {
          committed.current = true;
          return;
        }
      }
      if (!swiping.current) return;

      let newOffset = dx;
      if (newOffset > 0 && !onSwipeRight) newOffset = 0;
      if (newOffset < 0 && !onSwipeLeft) newOffset = 0;
      const max = ACTION_WIDTH + 20;
      if (Math.abs(newOffset) > max) {
        const over = Math.abs(newOffset) - max;
        newOffset = (newOffset > 0 ? 1 : -1) * (max + over * 0.2);
      }
      setOffset(newOffset);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!swiping.current) { resetPosition(); return; }

      // Read current offset from the state via a ref trick — use currentX
      const dx = currentX.current - startX.current;
      // We'll use the setOffset callback to trigger action
      setOffset(prev => {
        if (prev > SWIPE_THRESHOLD && onSwipeRight) {
          setTimeout(() => { resetPosition(); onSwipeRight(); }, 200);
          return ACTION_WIDTH;
        } else if (prev < -SWIPE_THRESHOLD && onSwipeLeft) {
          setTimeout(() => { resetPosition(); onSwipeLeft(); }, 200);
          return -ACTION_WIDTH;
        }
        setTimeout(resetPosition, 0);
        return 0;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onSwipeLeft, onSwipeRight, resetPosition]);

  const showingDelete = offset > 10;
  const showingClear = offset < -10;
  const deleteReady = offset > SWIPE_THRESHOLD;
  const clearReady = offset < -SWIPE_THRESHOLD;

  return (
    <div
      ref={rowRef}
      style={{ position: 'relative', overflow: 'hidden', touchAction: isDragging ? 'none' : 'pan-y' }}
    >
      {/* Delete action (swipe right reveals on left) */}
      {onSwipeRight && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: Math.max(Math.abs(offset), 0),
          background: deleteReady ? '#dc2626' : '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px', color: 'white', fontSize: '12px', fontWeight: 700,
          transition: isDragging ? 'none' : 'all 0.25s ease',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          <Trash2 size={18} />
          {offset > 50 && <span>{rightLabel}</span>}
        </div>
      )}

      {/* Clear action (swipe left reveals on right) */}
      {onSwipeLeft && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0, right: 0,
          width: Math.max(Math.abs(offset), 0),
          background: clearReady ? '#2563eb' : '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px', color: 'white', fontSize: '12px', fontWeight: 700,
          transition: isDragging ? 'none' : 'all 0.25s ease',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          <Paintbrush size={18} />
          {Math.abs(offset) > 50 && <span>{leftLabel}</span>}
        </div>
      )}

      {/* Row content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease',
          position: 'relative',
          zIndex: 1,
          background: 'var(--mc-sidebar, #ffffff)',
          userSelect: isDragging ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  currentUser,
  conversations,
  groups,
  activeConversationId,
  activeTab,
  onTabChange,
  onSelectConversation,
  onSelectGroup,
  onNewChat,
  onNewGroup,
  onOpenSettings,
  onBack,
  className = '',
  onDeleteConversation,
  onClearConversation,
  onDeleteGroup,
  onClearGroup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.otherUserName.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  return (
    <div className={`mensajes-sidebar ${className}`}>
      {/* ─── Header ─── */}
      <div className="mensajes-sidebar-header">
        {onBack && (
          <button onClick={onBack} title="Inicio" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a9a',
            padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, marginRight: '4px',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#1d4ed8'; e.currentTarget.style.background = 'rgba(29,78,216,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8a8a9a'; e.currentTarget.style.background = 'none'; }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="mensajes-sidebar-user">
          <div className="mensajes-sidebar-user-avatar" onClick={onOpenSettings}
            style={{ cursor: onOpenSettings ? 'pointer' : 'default', position: 'relative' }}
            title={onOpenSettings ? 'Configuracion de perfil' : undefined}>
            {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : getInitials(currentUser.fullName)}
            {onOpenSettings && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s',
              }} className="avatar-hover-overlay">
                <Settings size={14} style={{ color: 'white' }} />
              </div>
            )}
          </div>
          <div className="mensajes-sidebar-user-info">
            <div className="mensajes-sidebar-user-name">{currentUser.fullName}</div>
            <div className="mensajes-sidebar-user-status">
              {currentUser.username ? `@${currentUser.username}` : 'Disponible'}
            </div>
          </div>
        </div>
        {onOpenSettings && (
          <button onClick={onOpenSettings} title="Configuracion" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a9a',
            padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#1d4ed8'; e.currentTarget.style.background = 'rgba(29,78,216,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8a8a9a'; e.currentTarget.style.background = 'none'; }}
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* ─── Mode header ─── */}
      <div className="mensajes-tabs">
        <div className="mensajes-tab active" style={{ flex: 1, cursor: 'default' }}>
          {activeTab === 'chats' ? <MessageCircle size={16} /> : <Users size={16} />}
          {activeTab === 'chats' ? 'Mensajes Directos' : 'Grupos'}
          {activeTab === 'chats' && totalUnread > 0 && (
            <span className="mensajes-tab-badge">{totalUnread}</span>
          )}
        </div>
        <button onClick={() => onTabChange(activeTab === 'chats' ? 'groups' : 'chats')}
          title={activeTab === 'chats' ? 'Ir a Grupos' : 'Ir a Chats'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8',
            padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center',
            gap: '6px', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(29,78,216,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          {activeTab === 'chats' ? <Users size={15} /> : <MessageCircle size={15} />}
          {activeTab === 'chats' ? 'Grupos' : 'Chats'}
          <ArrowRightLeft size={13} />
        </button>
      </div>

      {/* ─── Search ─── */}
      <div className="mensajes-search">
        <div className="mensajes-search-wrapper">
          <Search className="mensajes-search-icon" />
          <input className="mensajes-search-input" type="text" placeholder="Buscar chats..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* ─── Chat List ─── */}
      <div className="mensajes-chat-list">
        {activeTab === 'chats' && (
          <>
            {/* New Chat Button */}
            <div className="mensajes-chat-item" onClick={onNewChat}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="mensajes-chat-avatar">
                <div className="mensajes-chat-avatar-img"
                  style={{ background: 'rgba(29, 78, 216, 0.08)', color: '#1d4ed8', border: '1px solid rgba(29, 78, 216, 0.15)' }}>
                  <UserPlus size={20} />
                </div>
              </div>
              <div className="mensajes-chat-info">
                <div className="mensajes-chat-name" style={{ color: '#1d4ed8' }}>Nuevo Chat</div>
                <div className="mensajes-chat-preview">Buscar por telefono, email o @usuario</div>
              </div>
            </div>

            {filteredConversations.length === 0 ? (
              <div className="mensajes-empty-state">
                <MessageCircle size={40} strokeWidth={1} />
                <p>No hay chats</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <SwipeableRow
                  key={conv.id}
                  onSwipeRight={onDeleteConversation ? () => onDeleteConversation(conv.id) : undefined}
                  onSwipeLeft={onClearConversation ? () => onClearConversation(conv.id) : undefined}
                  rightLabel="Eliminar"
                  leftLabel="Limpiar"
                >
                  <div
                    className={`mensajes-chat-item ${activeConversationId === conv.id ? 'active' : ''}`}
                    onClick={() => onSelectConversation(conv.id)}
                  >
                    <div className="mensajes-chat-avatar">
                      <div className="mensajes-chat-avatar-img">
                        {conv.otherUserAvatar ? <img src={conv.otherUserAvatar} alt="" /> : getInitials(conv.otherUserName)}
                      </div>
                      <div className={conv.otherUserOnline ? 'online-dot' : 'offline-dot'} />
                    </div>
                    <div className="mensajes-chat-info">
                      <div className="mensajes-chat-name-row">
                        <span className="mensajes-chat-name">{conv.otherUserName}</span>
                        <span className="mensajes-chat-time">{formatTime(conv.lastMessageAt)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mensajes-chat-preview">{conv.lastMessage || 'Sin mensajes'}</span>
                        {conv.unreadCount > 0 && (
                          <span className="mensajes-chat-unread">{conv.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              ))
            )}
          </>
        )}

        {activeTab === 'groups' && (
          <>
            <div className="mensajes-chat-item" onClick={onNewGroup}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="mensajes-chat-avatar">
                <div className="mensajes-chat-avatar-img" style={{ background: '#1d4ed8', color: '#ffffff' }}>
                  <Plus size={20} />
                </div>
              </div>
              <div className="mensajes-chat-info">
                <div className="mensajes-chat-name" style={{ color: '#1d4ed8' }}>Nuevo Grupo</div>
                <div className="mensajes-chat-preview">Crear grupo de chat</div>
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <div className="mensajes-empty-state">
                <Users size={40} strokeWidth={1} />
                <p>No hay grupos</p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <SwipeableRow
                  key={group.id}
                  onSwipeRight={onDeleteGroup ? () => onDeleteGroup(group.id) : undefined}
                  onSwipeLeft={onClearGroup ? () => onClearGroup(group.id) : undefined}
                  rightLabel="Eliminar"
                  leftLabel="Limpiar"
                >
                  <div
                    className={`mensajes-chat-item ${activeConversationId === group.id ? 'active' : ''}`}
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <div className="mensajes-chat-avatar">
                      <div className="mensajes-chat-avatar-img">
                        {group.avatarUrl ? <img src={group.avatarUrl} alt="" /> : <Users size={20} />}
                      </div>
                    </div>
                    <div className="mensajes-chat-info">
                      <div className="mensajes-chat-name-row">
                        <span className="mensajes-chat-name">{group.name}</span>
                        <span className="mensajes-chat-time">{formatTime(group.lastMessageAt)}</span>
                      </div>
                      <div className="mensajes-chat-preview">
                        {group.lastMessage || `${group.memberCount} miembros`}
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;