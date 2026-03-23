/**
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */
import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useTranslation, type Language } from '@/i18n';
import HomeMenuItem from '@/components/home/HomeMenuItem';
import {
  ChatBubblesIcon,
  GroupPeopleIcon,
  PaymentsIcon,
  CommunityIcon,
  SettingsGearIcon,
} from '@/components/home/HomeIcons';
import '@/styles/HomeScreen.css';

const LANGS: { code: Language; flag: string }[] = [
  { code: 'es', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'en', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'ru', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'zh', flag: '\u{1F1E8}\u{1F1F3}' },
];

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const unread = useUnreadCounts(user?.id);
  const [entered, setEntered] = useState(false);
  const { t, lang, setLang } = useTranslation();

  useEffect(() => {
    const f = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(f);
  }, []);

  const menuItems = useMemo(() => [
    { id: 'chats', icon: <ChatBubblesIcon />, label: t.home.chats, route: '/mensajes', state: { initialTab: 'chats' }, badgeKey: 'chats' as const },
    { id: 'groups', icon: <GroupPeopleIcon />, label: t.home.groups, route: '/mensajes', state: { initialTab: 'groups' }, badgeKey: 'groups' as const },
    { id: 'payments', icon: <PaymentsIcon />, label: t.home.payments, route: '/pagos' },
    { id: 'community', icon: <CommunityIcon />, label: t.home.community, route: '/comunidad' },
  ], [t]);

  const items = useMemo(() =>
    menuItems.map((item) => ({
      ...item,
      badge: item.badgeKey ? unread[item.badgeKey] : undefined,
    })),
    [menuItems, unread]
  );

  return (
    <div className="home-screen">
      {/* Language toggle â€” top right, mobile-first */}
      <div
        className="home-lang-toggle"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'all 0.4s ease-out 100ms',
        }}
      >
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`home-lang-btn ${lang === l.code ? 'active' : ''}`}
            aria-label={l.code}
          >
            <span className="home-lang-flag">{l.flag}</span>
          </button>
        ))}
      </div>

      {/* Header */}
      <h1
        className="home-screen-title"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(-20px)',
          transition: 'all 0.5s ease-out',
        }}
      >
        <span className="text-gray-900">Mexi</span>
        <span className="text-blue-500">Chat</span>
      </h1>

      {/* Icon grid */}
      <div className="home-grid">
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(30px)',
              transition: `all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${150 + i * 100}ms`,
            }}
          >
            <HomeMenuItem
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              onClick={() => navigate(item.route, { state: item.state })}
            />
          </div>
        ))}
      </div>

      {/* Settings button */}
      <button
        onClick={() => navigate('/mensajes', { state: { openSettings: true } })}
        aria-label={t.home.settings}
        className="home-settings-btn"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.5s ease-out 650ms',
        }}
      >
        <SettingsGearIcon />
      </button>
    </div>
  );
};

export default HomeScreen;