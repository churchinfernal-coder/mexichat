/**
 * MexiChat - New Chat / Add Contact Modal
 * WhatsApp-style: shows discovered contacts, search users, invite friends
 * Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, X, UserPlus, Users, Share2,
  ArrowRight, Loader2, MessageCircle, ChevronRight,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { discoverContacts } from '@/services/contactSync';

interface NewChatModalProps {
  userId: string;
  search: {
    query: string;
    setQuery: (q: string) => void;
    results: any[];
    isSearching: boolean;
    clear: () => void;
  };
  onStartConversation: (otherUserId: string) => void;
  onClose: () => void;
  MC: Record<string, string>;
}

interface DiscoveredContact {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
}

function getInitial(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

export default function NewChatModal({
  userId, search, onStartConversation, onClose, MC,
}: NewChatModalProps) {
  const [tab, setTab] = useState<'contacts' | 'search'>('contacts');
  const [discoveredContacts, setDiscoveredContacts] = useState<DiscoveredContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [invitePhone, setInvitePhone] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const contacts = await discoverContacts(userId);
        if (!cancelled) setDiscoveredContacts(contacts);
      } catch (err) {
        console.warn('[NewChat] Failed to load discovered contacts:', err);
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (search.query.length > 0) setTab('search');
  }, [search.query]);

  const handleInvite = useCallback(async () => {
    const phone = invitePhone.replace(/[^\d+]/g, '');
    if (phone.length < 8) return;
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'MexiChat',
          text: 'Unete a MexiChat! La mensajeria de Mexico para el mundo. Descargala gratis:',
          url: 'https://mexichat.mx/download',
          dialogTitle: 'Invitar a MexiChat',
        });
      } catch (err) {
        console.warn('[NewChat] Share failed:', err);
      }
    } else {
      const msg = encodeURIComponent(
        'Unete a MexiChat! La mensajeria de Mexico para el mundo. Descargala gratis: https://mexichat.mx/download'
      );
      window.open(`sms:${phone}?body=${msg}`, '_blank');
    }
    setInvitePhone('');
    setShowInvite(false);
  }, [invitePhone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 100, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: MC.sidebar || '#fff', borderRadius: '20px',
        width: '100%', maxWidth: '440px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: `1px solid ${MC.border || '#e2e8f0'}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${MC.border || '#e2e8f0'}`,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: MC.text || '#0f172a', margin: 0 }}>
              Nuevo Chat
            </h2>
            <p style={{ fontSize: '12px', color: MC.textMuted || '#64748b', margin: '2px 0 0' }}>
              Contactos y busqueda
            </p>
          </div>
          <button onClick={() => { onClose(); search.clear(); }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: MC.textMuted || '#64748b', padding: '8px', borderRadius: '10px', display: 'flex',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: MC.inputBg || '#f1f5f9', borderRadius: '12px',
            padding: '0 14px', border: `1px solid ${MC.border || '#e2e8f0'}`,
          }}>
            <Search size={16} style={{ color: MC.textMuted || '#94a3b8', flexShrink: 0 }} />
            <input type="text" placeholder="Buscar por @usuario, nombre o telefono..."
              value={search.query} onChange={(e) => search.setQuery(e.target.value)}
              autoFocus maxLength={60}
              style={{
                flex: 1, padding: '12px 0', background: 'none', border: 'none',
                color: MC.text || '#0f172a', fontSize: '14px', outline: 'none',
              }}
            />
            {search.query && (
              <button onClick={() => { search.clear(); setTab('contacts'); }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: MC.textMuted || '#94a3b8', padding: '4px',
              }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', padding: '0 16px', gap: '4px',
          borderBottom: `1px solid ${MC.border || '#e2e8f0'}`,
        }}>
          {([
            { key: 'contacts' as const, label: 'Contactos', icon: <Users size={14} /> },
            { key: 'search' as const, label: 'Buscar', icon: <Search size={14} /> },
          ]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '6px', padding: '10px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, background: 'none',
              color: tab === t.key ? '#2563eb' : (MC.textMuted || '#94a3b8'),
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>

          {/* Contacts Tab */}
          {tab === 'contacts' && (
            <>
              {/* Invite button */}
              <button onClick={() => setShowInvite(!showInvite)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: showInvite ? 'rgba(37,99,235,0.08)' : 'transparent',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'rgba(37,99,235,0.1)', color: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <UserPlus size={20} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#2563eb' }}>Invitar amigos</div>
                  <div style={{ fontSize: '12px', color: MC.textMuted || '#64748b' }}>Comparte MexiChat por SMS o link</div>
                </div>
                <ChevronRight size={16} style={{
                  color: '#2563eb', transform: showInvite ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s',
                }} />
              </button>

              {/* Invite panel */}
              {showInvite && (
                <div style={{ padding: '12px 16px', margin: '0 0 8px', background: 'rgba(37,99,235,0.04)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="tel" placeholder="+52 55 1234 5678" value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)} maxLength={20}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: '10px',
                        border: `1px solid ${MC.border || '#e2e8f0'}`,
                        background: MC.inputBg || '#fff', color: MC.text || '#0f172a',
                        fontSize: '14px', outline: 'none',
                      }}
                    />
                    <button onClick={handleInvite} style={{
                      padding: '10px 16px', borderRadius: '10px', border: 'none',
                      background: '#2563eb', color: 'white', fontWeight: 700,
                      fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <Share2 size={14} /> Invitar
                    </button>
                  </div>
                </div>
              )}

              {/* Discovered contacts header */}
              {discoveredContacts.length > 0 && (
                <div style={{
                  padding: '12px 12px 6px', fontSize: '11px', fontWeight: 700,
                  color: MC.textMuted || '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Contactos en MexiChat ({discoveredContacts.length})
                </div>
              )}

              {loadingContacts && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', padding: '30px', color: MC.textMuted || '#94a3b8', fontSize: '13px',
                }}>
                  <Loader2 size={16} className="animate-spin" />
                  Cargando contactos...
                </div>
              )}

              {!loadingContacts && discoveredContacts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: MC.textMuted || '#94a3b8' }}>
                  <Users size={36} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Sin contactos aun</p>
                  <p style={{ fontSize: '12px', margin: 0 }}>Sincroniza tus contactos en la configuracion o invita amigos</p>
                </div>
              )}

              {discoveredContacts.map((contact) => (
                <button key={contact.id} onClick={() => onStartConversation(contact.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '12px', border: 'none',
                  cursor: 'pointer', background: 'transparent', textAlign: 'left',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = MC.sidebarHover || '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: MC.sidebarActive || '#e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 700, overflow: 'hidden', color: '#2563eb', flexShrink: 0,
                  }}>
                    {contact.avatar_url
                      ? <img src={contact.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitial(contact.full_name)
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: MC.text || '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contact.full_name || 'Usuario'}
                    </div>
                    <div style={{ fontSize: '12px', color: MC.textMuted || '#64748b' }}>
                      {contact.username ? `@${contact.username}` : 'En MexiChat'}
                    </div>
                  </div>
                  <MessageCircle size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
                </button>
              ))}
            </>
          )}

          {/* Search Tab */}
          {tab === 'search' && (
            <>
              {search.isSearching && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', padding: '30px', color: MC.textMuted || '#94a3b8', fontSize: '13px',
                }}>
                  <Loader2 size={16} className="animate-spin" />
                  Buscando...
                </div>
              )}

              {search.results.length === 0 && search.query.length >= 2 && !search.isSearching && (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: MC.textMuted || '#94a3b8' }}>
                  <Search size={36} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>No se encontraron usuarios</p>
                  <p style={{ fontSize: '12px', margin: 0 }}>Intenta con otro nombre, @usuario o numero</p>
                </div>
              )}

              {search.query.length < 2 && !search.isSearching && (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: MC.textMuted || '#94a3b8', fontSize: '13px' }}>
                  Escribe al menos 2 caracteres para buscar
                </div>
              )}

              {search.results.map((p: any) => (
                <button key={p.user_id} onClick={() => onStartConversation(p.user_id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '12px', border: 'none',
                  cursor: 'pointer', background: 'transparent', textAlign: 'left',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = MC.sidebarHover || '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: MC.sidebarActive || '#e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 700, overflow: 'hidden', color: '#2563eb', flexShrink: 0,
                  }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitial(p.full_name || '')
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: MC.text || '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.full_name || 'Usuario'}
                    </div>
                    <div style={{ fontSize: '12px', color: MC.textMuted || '#64748b' }}>
                      {p.username ? `@${p.username}` : p.phone || ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: p.is_online ? (MC.online || '#22c55e') : (MC.offline || '#94a3b8'),
                    }} />
                    <ArrowRight size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}