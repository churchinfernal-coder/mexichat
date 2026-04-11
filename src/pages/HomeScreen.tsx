/**
 * MEXICHAT — HomeScreen
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */
import React, { useMemo, useEffect, useState, useRef } from 'react';
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
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import AppTutorial from '@/components/tutorial/AppTutorial';
import { useTutorial } from '@/hooks/useTutorial';

const LANGS: { code: Language; flag: string }[] = [
  { code: 'es', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'en', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'ru', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'zh', flag: '\u{1F1E8}\u{1F1F3}' },
];

const STAR_COUNT = 180;
const SHOOTING_STAR_COUNT = 3;

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const unread = useUnreadCounts(user?.id);
  const [entered, setEntered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (!user?.id) return false;
    return !localStorage.getItem('mexichat_onboarded_' + user.id);
  });
  const { t, lang, setLang } = useTranslation();

  /* ── Tutorial ── */
  const { shouldShow: showTutorial, dismiss: dismissTutorial } = useTutorial(user?.id);
  const tutorialVisible = showTutorial && !showOnboarding;

  useEffect(() => {
    const f = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(f);
  }, []);

  // Galaxy canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    // Stars
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.3,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.02 + 0.005,
      phase: Math.random() * Math.PI * 2,
    }));

    // Shooting stars
    const shootingStars = Array.from({ length: SHOOTING_STAR_COUNT }, () => ({
      x: -100,
      y: -100,
      len: Math.random() * 80 + 40,
      speed: Math.random() * 6 + 4,
      angle: Math.PI / 6 + Math.random() * 0.3,
      alpha: 0,
      active: false,
      timer: Math.random() * 400 + 200,
    }));

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let tick = 0;
    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, w, h);

      // Twinkling stars
      for (const s of stars) {
        const twinkle = Math.sin(tick * s.speed + s.phase) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * twinkle})`;
        ctx.fill();
      }

      // Shooting stars
      for (const ss of shootingStars) {
        if (!ss.active) {
          ss.timer--;
          if (ss.timer <= 0) {
            ss.active = true;
            ss.x = Math.random() * w * 0.8;
            ss.y = Math.random() * h * 0.3;
            ss.alpha = 1;
            ss.len = Math.random() * 80 + 40;
          }
          continue;
        }

        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.alpha -= 0.008;

        if (ss.alpha <= 0 || ss.x > w + 100 || ss.y > h + 100) {
          ss.active = false;
          ss.timer = Math.random() * 500 + 300;
          continue;
        }

        const tailX = ss.x - Math.cos(ss.angle) * ss.len;
        const tailY = ss.y - Math.sin(ss.angle) * ss.len;

        const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${ss.alpha})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glow head
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${ss.alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
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
    <div className="home-screen home-screen--galaxy">
      {/* Galaxy animated background */}
      <canvas ref={canvasRef} className="home-galaxy-canvas" />

      {/* ① Onboarding — first-time account setup (shows first) */}
      {showOnboarding && user?.id && (
        <OnboardingModal userId={user.id} onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ② Tutorial — app walkthrough (shows after onboarding completes) */}
      {tutorialVisible && (
        <AppTutorial onComplete={dismissTutorial} />
      )}

      {/* Language toggle */}
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
        <span className="text-white">Mexi</span>
        <span className="text-blue-400">Chat</span>
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
