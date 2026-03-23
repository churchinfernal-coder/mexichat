import React, { useState, useMemo } from 'react';
import {
  MessageCircle, Users, Search, Plus, UserPlus, Settings, ArrowLeft, ArrowRightLeft
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

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
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Ayer';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

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
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      c.otherUserName.toLowerCase().includes(q)
    );
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
        {/* Back to home */}
        {onBack && (
          <button
            onClick={onBack}
            title="Inicio"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8a8a9a',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
              marginRight: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#1d4ed8';
              e.currentTarget.style.background = 'rgba(29,78,216,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#8a8a9a';
              e.currentTarget.style.background = 'none';
            }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="mensajes-sidebar-user">
          <div
            className="mensajes-sidebar-user-avatar"
            onClick={onOpenSettings}
            style={{
              cursor: onOpenSettings ? 'pointer' : 'default',
              position: 'relative',
            }}
            title={onOpenSettings ? 'Configuración de perfil' : undefined}
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" />
            ) : (
              getInitials(currentUser.fullName)
            )}
            {/* Small camera indicator on hover */}
            {onOpenSettings && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s',
              }}
                className="avatar-hover-overlay"
              >
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

        {/* Settings gear button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Configuración"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8a8a9a',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#1d4ed8';
              e.currentTarget.style.background = 'rgba(29,78,216,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#8a8a9a';
              e.currentTarget.style.background = 'none';
            }}
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* ─── Mode header (single view, not tabs) ─── */}
      <div className="mensajes-tabs">
        <div
          className="mensajes-tab active"
          style={{ flex: 1, cursor: 'default' }}
        >
          {activeTab === 'chats' ? <MessageCircle size={16} /> : <Users size={16} />}
          {activeTab === 'chats' ? 'Mensajes Directos' : 'Grupos'}
          {activeTab === 'chats' && totalUnread > 0 && (
            <span className="mensajes-tab-badge">{totalUnread}</span>
          )}
        </div>
        {/* Crossover link to switch view */}
        <button
          onClick={() => onTabChange(activeTab === 'chats' ? 'groups' : 'chats')}
          title={activeTab === 'chats' ? 'Ir a Grupos' : 'Ir a Chats'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#1d4ed8',
            padding: '8px 12px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 0.2s',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(29,78,216,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
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
          <input
            className="mensajes-search-input"
            type="text"
            placeholder="Buscar chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Chat List ─── */}
      <div className="mensajes-chat-list">
        {activeTab === 'chats' && (
          <>
            {/* New Chat Button */}
            <div
              className="mensajes-chat-item"
              onClick={onNewChat}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="mensajes-chat-avatar">
                <div
                  className="mensajes-chat-avatar-img"
                  style={{ background: 'rgba(29, 78, 216, 0.08)', color: '#1d4ed8', border: '1px solid rgba(29, 78, 216, 0.15)' }}
                >
                  <UserPlus size={20} />
                </div>
              </div>
              <div className="mensajes-chat-info">
                <div className="mensajes-chat-name" style={{ color: '#1d4ed8' }}>
                  Nuevo Chat
                </div>
                <div className="mensajes-chat-preview">
                  Buscar por teléfono, email o @usuario
                </div>
              </div>
            </div>

            {filteredConversations.length === 0 ? (
              <div className="mensajes-empty-state">
                <MessageCircle size={40} strokeWidth={1} />
                <p>No hay chats</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`mensajes-chat-item ${activeConversationId === conv.id ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div className="mensajes-chat-avatar">
                    <div className="mensajes-chat-avatar-img">
                      {conv.otherUserAvatar ? (
                        <img src={conv.otherUserAvatar} alt="" />
                      ) : (
                        getInitials(conv.otherUserName)
                      )}
                    </div>
                    <div className={conv.otherUserOnline ? 'online-dot' : 'offline-dot'} />
                  </div>
                  <div className="mensajes-chat-info">
                    <div className="mensajes-chat-name-row">
                      <span className="mensajes-chat-name">{conv.otherUserName}</span>
                      <span className="mensajes-chat-time">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mensajes-chat-preview">
                        {conv.lastMessage || 'Sin mensajes'}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="mensajes-chat-unread">{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'groups' && (
          <>
            {/* New Group Button */}
            <div
              className="mensajes-chat-item"
              onClick={onNewGroup}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="mensajes-chat-avatar">
                <div
                  className="mensajes-chat-avatar-img"
                  style={{ background: '#1d4ed8', color: '#ffffff' }}
                >
                  <Plus size={20} />
                </div>
              </div>
              <div className="mensajes-chat-info">
                <div className="mensajes-chat-name" style={{ color: '#1d4ed8' }}>
                  Nuevo Grupo
                </div>
                <div className="mensajes-chat-preview">
                  Crear grupo de chat
                </div>
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <div className="mensajes-empty-state">
                <Users size={40} strokeWidth={1} />
                <p>No hay grupos</p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className={`mensajes-chat-item ${activeConversationId === group.id ? 'active' : ''}`}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <div className="mensajes-chat-avatar">
                    <div className="mensajes-chat-avatar-img">
                      {group.avatarUrl ? (
                        <img src={group.avatarUrl} alt="" />
                      ) : (
                        <Users size={20} />
                      )}
                    </div>
                  </div>
                  <div className="mensajes-chat-info">
                    <div className="mensajes-chat-name-row">
                      <span className="mensajes-chat-name">{group.name}</span>
                      <span className="mensajes-chat-time">
                        {formatTime(group.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mensajes-chat-preview">
                      {group.lastMessage || `${group.memberCount} miembros`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;