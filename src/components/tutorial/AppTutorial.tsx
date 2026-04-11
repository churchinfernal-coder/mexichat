/**
 * MexiChat — Interactive App Tutorial v1.0
 * Swipeable fullscreen walkthrough of all features
 * Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  MessageCircle, Phone, Video, Shield, Lock, Users, Search,
  Image, Mic, MapPin, Star, Clock, Bell, Palette, Globe,
  Send, Heart, Reply, Pin, Trash2, Share2, CreditCard,
  ShoppingBag, Play, Camera, Fingerprint, Eye, EyeOff,
  ChevronLeft, ChevronRight, X, CheckCircle2, Sparkles,
  UserPlus, ArrowRight, Bookmark, FileText, Volume2,
  MessageSquare, Settings, Home, Zap,
} from 'lucide-react';

interface TutorialProps {
  onComplete: () => void;
  language?: 'es' | 'en';
}

interface TutorialStep {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  features: { icon: React.ReactNode; text: string }[];
  tip?: string;
  category: string;
}

const STEPS_ES: TutorialStep[] = [
  // ── WELCOME ──
  {
    id: 'welcome',
    icon: <Sparkles size={40} />,
    iconBg: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    title: 'Bienvenido a MexiChat',
    subtitle: 'La mensajeria de Mexico para el mundo. Descubre todo lo que puedes hacer.',
    category: 'Inicio',
    features: [
      { icon: <Shield size={16} />, text: 'Cifrado de extremo a extremo en todos tus mensajes' },
      { icon: <Globe size={16} />, text: 'Disponible en Espanol, Ingles, Ruso y Chino' },
      { icon: <Zap size={16} />, text: 'Mensajeria instantanea, llamadas y videollamadas' },
      { icon: <CreditCard size={16} />, text: 'Pagos integrados con Mercado Pago y OXXO' },
    ],
    tip: 'Desliza para ver todas las funciones o toca las flechas',
  },
  // ── HOME SCREEN ──
  {
    id: 'home',
    icon: <Home size={40} />,
    iconBg: 'linear-gradient(135deg, #059669, #10b981)',
    title: 'Pantalla de Inicio',
    subtitle: 'Tu centro de control con acceso rapido a todas las secciones.',
    category: 'Navegacion',
    features: [
      { icon: <MessageCircle size={16} />, text: 'Mensajes — Chats privados y grupales' },
      { icon: <Users size={16} />, text: 'Comunidad — Foro, marketplace, videos y mas' },
      { icon: <CreditCard size={16} />, text: 'Pagos — Envia y recibe dinero al instante' },
      { icon: <Settings size={16} />, text: 'Perfil — Personaliza tu cuenta y seguridad' },
    ],
  },
  // ── MESSAGING ──
  {
    id: 'messaging',
    icon: <MessageCircle size={40} />,
    iconBg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    title: 'Mensajes Directos',
    subtitle: 'Chatea con tus contactos de forma segura y privada.',
    category: 'Mensajeria',
    features: [
      { icon: <Search size={16} />, text: 'Busca contactos por @usuario, nombre o telefono' },
      { icon: <UserPlus size={16} />, text: 'Invita amigos por SMS o comparte el link' },
      { icon: <Shield size={16} />, text: 'Todos los mensajes estan cifrados E2E automaticamente' },
      { icon: <CheckCircle2 size={16} />, text: 'Confirmaciones de lectura (puedes desactivarlas)' },
    ],
    tip: 'Toca "Nuevo Chat" en la barra lateral para iniciar una conversacion',
  },
  // ── MESSAGE FEATURES ──
  {
    id: 'msg-features',
    icon: <Send size={40} />,
    iconBg: 'linear-gradient(135deg, #0891b2, #06b6d4)',
    title: 'Superpoderes de Mensajes',
    subtitle: 'Mas que solo texto — explora todas las opciones.',
    category: 'Mensajeria',
    features: [
      { icon: <Mic size={16} />, text: 'Notas de voz — Manten presionado el microfono' },
      { icon: <Image size={16} />, text: 'Fotos y videos — Desde camara o galeria' },
      { icon: <Heart size={16} />, text: 'Reacciones — Toca y manten un mensaje para reaccionar' },
      { icon: <Reply size={16} />, text: 'Responder — Desliza un mensaje a la derecha' },
      { icon: <Pin size={16} />, text: 'Fijar mensajes — Manten presionado > Fijar' },
      { icon: <Star size={16} />, text: 'Favoritos — Guarda mensajes importantes' },
    ],
  },
  // ── SCHEDULED & DISAPPEARING ──
  {
    id: 'timed-msgs',
    icon: <Clock size={40} />,
    iconBg: 'linear-gradient(135deg, #d97706, #f59e0b)',
    title: 'Mensajes Programados y Temporales',
    subtitle: 'Controla cuando se envian y cuando desaparecen.',
    category: 'Mensajeria',
    features: [
      { icon: <Clock size={16} />, text: 'Programar envio — Elige fecha y hora exacta' },
      { icon: <EyeOff size={16} />, text: 'Mensajes que desaparecen — Se borran automaticamente' },
      { icon: <Bell size={16} />, text: 'Recordatorios — Pon alarma en mensajes importantes' },
      { icon: <FileText size={16} />, text: 'Borradores — Se guardan automaticamente' },
    ],
    tip: 'Toca el icono de reloj junto al boton de enviar para programar',
  },
  // ── VOICE & VIDEO CALLS ──
  {
    id: 'calls',
    icon: <Phone size={40} />,
    iconBg: 'linear-gradient(135deg, #16a34a, #22c55e)',
    title: 'Llamadas y Videollamadas',
    subtitle: 'Llamadas HD cifradas de extremo a extremo.',
    category: 'Llamadas',
    features: [
      { icon: <Phone size={16} />, text: 'Llamada de voz — Toca el icono de telefono en el chat' },
      { icon: <Video size={16} />, text: 'Videollamada — Toca el icono de camara en el chat' },
      { icon: <Shield size={16} />, text: 'Cifrado E2E — Nadie puede escuchar tus llamadas' },
      { icon: <Volume2 size={16} />, text: 'Altavoz, silenciar y cambiar camara durante la llamada' },
    ],
    tip: 'Las llamadas funcionan incluso con la app en segundo plano',
  },
  // ── GROUPS ──
  {
    id: 'groups',
    icon: <Users size={40} />,
    iconBg: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    title: 'Grupos de Chat',
    subtitle: 'Crea grupos para familia, amigos, trabajo o comunidad.',
    category: 'Grupos',
    features: [
      { icon: <Users size={16} />, text: 'Crea grupos con nombre, descripcion y avatar' },
      { icon: <UserPlus size={16} />, text: 'Invita miembros por link o buscandolos' },
      { icon: <Shield size={16} />, text: 'Roles: Propietario, Admin y Miembro' },
      { icon: <Settings size={16} />, text: 'Configura permisos por rol' },
    ],
    tip: 'Cambia a la pestana "Grupos" en mensajes para ver y crear grupos',
  },
  // ── LIVE LOCATION ──
  {
    id: 'location',
    icon: <MapPin size={40} />,
    iconBg: 'linear-gradient(135deg, #dc2626, #ef4444)',
    title: 'Ubicacion en Tiempo Real',
    subtitle: 'Comparte donde estas con quien tu elijas.',
    category: 'Mensajeria',
    features: [
      { icon: <MapPin size={16} />, text: 'Ubicacion estatica — Envia tu punto actual' },
      { icon: <MapPin size={16} />, text: 'Ubicacion en vivo — Comparte por 15min, 1h u 8h' },
      { icon: <Eye size={16} />, text: 'Mapa interactivo — Ve la ubicacion en tiempo real' },
      { icon: <EyeOff size={16} />, text: 'Detener en cualquier momento' },
    ],
    tip: 'Toca el icono de ubicacion en la barra de mensajes',
  },
  // ── COMMUNITY ──
  {
    id: 'community',
    icon: <ShoppingBag size={40} />,
    iconBg: 'linear-gradient(135deg, #ea580c, #f97316)',
    title: 'Comunidad MexiVanza',
    subtitle: 'Foro, marketplace, videos y mas — todo en un solo lugar.',
    category: 'Comunidad',
    features: [
      { icon: <MessageSquare size={16} />, text: 'Foro — Publica y comenta en la comunidad' },
      { icon: <ShoppingBag size={16} />, text: 'MexiMart — Compra y vende productos' },
      { icon: <Play size={16} />, text: 'MexiClips — Videos cortos estilo TikTok/Reels' },
      { icon: <Bookmark size={16} />, text: 'Guarda publicaciones y productos favoritos' },
    ],
    tip: 'Ve a Comunidad desde la pantalla de inicio',
  },
  // ── PAYMENTS ──
  {
    id: 'payments',
    icon: <CreditCard size={40} />,
    iconBg: 'linear-gradient(135deg, #0891b2, #06b6d4)',
    title: 'Pagos MexiPay',
    subtitle: 'Envia y recibe dinero de forma segura.',
    category: 'Pagos',
    features: [
      { icon: <Send size={16} />, text: 'Envia dinero a cualquier contacto de MexiChat' },
      { icon: <CreditCard size={16} />, text: 'Paga con Mercado Pago (tarjeta, transferencia)' },
      { icon: <ShoppingBag size={16} />, text: 'Paga en OXXO con referencia generada' },
      { icon: <FileText size={16} />, text: 'Historial completo de transacciones' },
    ],
    tip: 'Tambien puedes solicitar pagos dentro de un chat',
  },
  // ── SECURITY ──
  {
    id: 'security',
    icon: <Lock size={40} />,
    iconBg: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    title: 'Seguridad y Privacidad',
    subtitle: 'Tu seguridad es nuestra prioridad #1.',
    category: 'Seguridad',
    features: [
      { icon: <Shield size={16} />, text: 'Cifrado E2E — Ni MexiChat puede leer tus mensajes' },
      { icon: <Fingerprint size={16} />, text: 'Bloqueo biometrico — Face ID / huella dactilar' },
      { icon: <Lock size={16} />, text: 'Bloqueo por PIN — Protege chats individuales' },
      { icon: <EyeOff size={16} />, text: 'Controla quien ve tu foto, estado y ultima conexion' },
      { icon: <Trash2 size={16} />, text: 'Elimina tu cuenta y todos tus datos en cualquier momento' },
    ],
    tip: 'Configura seguridad en Perfil > Configuracion',
  },
  // ── PERSONALIZATION ──
  {
    id: 'personalize',
    icon: <Palette size={40} />,
    iconBg: 'linear-gradient(135deg, #c026d3, #e879f9)',
    title: 'Personaliza Tu Experiencia',
    subtitle: 'Haz MexiChat tuyo con temas, fondos y mas.',
    category: 'Personalizacion',
    features: [
      { icon: <Palette size={16} />, text: '5 temas: Default, Platinum, Diamond, Gold, Obsidian' },
      { icon: <Image size={16} />, text: 'Fondos de chat personalizados por conversacion' },
      { icon: <Globe size={16} />, text: '4 idiomas: Espanol, Ingles, Ruso, Chino' },
      { icon: <Bell size={16} />, text: 'Tonos de notificacion personalizados' },
    ],
    tip: 'Ve a Perfil > Configuracion > Apariencia',
  },
  // ── TRANSLATE ──
  {
    id: 'translate',
    icon: <Globe size={40} />,
    iconBg: 'linear-gradient(135deg, #0d9488, #14b8a6)',
    title: 'Traduccion Automatica',
    subtitle: 'Habla con cualquiera sin importar el idioma.',
    category: 'Mensajeria',
    features: [
      { icon: <Globe size={16} />, text: 'Traduce mensajes con un toque' },
      { icon: <Zap size={16} />, text: 'Auto-traduccion — Traduce mensajes entrantes automaticamente' },
      { icon: <MessageCircle size={16} />, text: 'Soporta multiples idiomas' },
    ],
    tip: 'Toca el icono de traduccion en cualquier mensaje',
  },
  // ── READY ──
  {
    id: 'ready',
    icon: <CheckCircle2 size={40} />,
    iconBg: 'linear-gradient(135deg, #16a34a, #4ade80)',
    title: 'Listo para Comenzar!',
    subtitle: 'Ya conoces todas las funciones. Empieza a chatear!',
    category: 'Final',
    features: [
      { icon: <MessageCircle size={16} />, text: 'Envia tu primer mensaje a un amigo' },
      { icon: <UserPlus size={16} />, text: 'Invita a tus contactos a MexiChat' },
      { icon: <Users size={16} />, text: 'Crea un grupo con tu familia o amigos' },
      { icon: <Heart size={16} />, text: 'Explora la comunidad MexiVanza' },
    ],
    tip: 'Puedes volver a ver este tutorial en Perfil > Ayuda > Tutorial',
  },
];

const STEPS_EN: TutorialStep[] = [
  {
    id: 'welcome',
    icon: <Sparkles size={40} />,
    iconBg: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    title: 'Welcome to MexiChat',
    subtitle: 'Mexico\'s messaging app for the world. Discover everything you can do.',
    category: 'Start',
    features: [
      { icon: <Shield size={16} />, text: 'End-to-end encryption on all your messages' },
      { icon: <Globe size={16} />, text: 'Available in Spanish, English, Russian and Chinese' },
      { icon: <Zap size={16} />, text: 'Instant messaging, voice and video calls' },
      { icon: <CreditCard size={16} />, text: 'Integrated payments with Mercado Pago and OXXO' },
    ],
    tip: 'Swipe to see all features or tap the arrows',
  },
  {
    id: 'home',
    icon: <Home size={40} />,
    iconBg: 'linear-gradient(135deg, #059669, #10b981)',
    title: 'Home Screen',
    subtitle: 'Your control center with quick access to all sections.',
    category: 'Navigation',
    features: [
      { icon: <MessageCircle size={16} />, text: 'Messages — Private and group chats' },
      { icon: <Users size={16} />, text: 'Community — Forum, marketplace, videos and more' },
      { icon: <CreditCard size={16} />, text: 'Payments — Send and receive money instantly' },
      { icon: <Settings size={16} />, text: 'Profile — Customize your account and security' },
    ],
  },
  {
    id: 'ready',
    icon: <CheckCircle2 size={40} />,
    iconBg: 'linear-gradient(135deg, #16a34a, #4ade80)',
    title: 'Ready to Go!',
    subtitle: 'You now know all the features. Start chatting!',
    category: 'Final',
    features: [
      { icon: <MessageCircle size={16} />, text: 'Send your first message to a friend' },
      { icon: <UserPlus size={16} />, text: 'Invite your contacts to MexiChat' },
      { icon: <Users size={16} />, text: 'Create a group with family or friends' },
      { icon: <Heart size={16} />, text: 'Explore the MexiVanza community' },
    ],
    tip: 'You can revisit this tutorial in Profile > Help > Tutorial',
  },
];

export default function AppTutorial({ onComplete, language = 'es' }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const steps = language === 'en' ? STEPS_EN : STEPS_ES;
  const totalSteps = steps.length;
  const step = steps[currentStep];
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  const goTo = useCallback((idx: number, dir: 'left' | 'right') => {
    if (isAnimating || idx < 0 || idx >= totalSteps) return;
    setIsAnimating(true);
    setDirection(dir);
    setTimeout(() => {
      setCurrentStep(idx);
      setDirection(null);
      setIsAnimating(false);
    }, 200);
  }, [isAnimating, totalSteps]);

  const next = useCallback(() => {
    if (isLast) { onComplete(); return; }
    goTo(currentStep + 1, 'left');
  }, [currentStep, isLast, goTo, onComplete]);

  const prev = useCallback(() => {
    if (!isFirst) goTo(currentStep - 1, 'right');
  }, [currentStep, isFirst, goTo]);

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchEnd(e.touches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };
  const handleTouchEnd = () => {
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') onComplete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, onComplete]);

  const animClass = direction === 'left' ? 'tutorial-slide-left' : direction === 'right' ? 'tutorial-slide-right' : 'tutorial-slide-in';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#030712',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      ref={containerRef}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {step.category}
          </span>
          <span style={{ fontSize: '11px', color: '#475569' }}>
            {currentStep + 1}/{totalSteps}
          </span>
        </div>
        <button onClick={onComplete} style={{
          background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer',
          color: '#94a3b8', padding: '6px 14px', borderRadius: '20px',
          fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <X size={14} /> {language === 'en' ? 'Skip' : 'Saltar'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', gap: '3px', height: '3px',
        }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: '2px',
              background: i <= currentStep ? '#2563eb' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 24px 0',
        overflow: 'hidden',
      }}>
        <div className={animClass} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: '400px', width: '100%',
        }}>
          {/* Icon */}
          <div style={{
            width: '88px', height: '88px', borderRadius: '24px',
            background: step.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginBottom: '24px',
            boxShadow: '0 8px 32px rgba(37,99,235,0.3)',
          }}>
            {step.icon}
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '24px', fontWeight: 800, color: '#f8fafc',
            textAlign: 'center', margin: '0 0 8px', lineHeight: 1.2,
          }}>
            {step.title}
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '14px', color: '#94a3b8', textAlign: 'center',
            margin: '0 0 28px', lineHeight: 1.5, maxWidth: '320px',
          }}>
            {step.subtitle}
          </p>

          {/* Feature list */}
          <div style={{
            width: '100%', display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {step.features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  color: '#60a5fa', flexShrink: 0,
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: 'rgba(37,99,235,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {f.icon}
                </div>
                <span style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.4 }}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>

          {/* Tip */}
          {step.tip && (
            <div style={{
              marginTop: '16px', padding: '10px 16px', borderRadius: '10px',
              background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)',
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            }}>
              <Sparkles size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#93c5fd', lineHeight: 1.4 }}>
                {step.tip}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div style={{
        padding: '20px 24px 32px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      }}>
        {/* Back button */}
        <button onClick={prev} disabled={isFirst} style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: isFirst ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
          border: 'none', cursor: isFirst ? 'default' : 'pointer',
          color: isFirst ? '#334155' : '#94a3b8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          <ChevronLeft size={20} />
        </button>

        {/* Dots */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {steps.map((_, i) => (
            <button key={i} onClick={() => goTo(i, i > currentStep ? 'left' : 'right')} style={{
              width: i === currentStep ? '20px' : '6px',
              height: '6px', borderRadius: '3px',
              background: i === currentStep ? '#2563eb' : 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Next / Finish button */}
        <button onClick={next} style={{
          height: '48px', borderRadius: '24px', border: 'none', cursor: 'pointer',
          background: isLast ? 'linear-gradient(135deg, #16a34a, #22c55e)' : '#2563eb',
          color: 'white', fontWeight: 700, fontSize: '14px',
          padding: isLast ? '0 24px' : '0',
          width: isLast ? 'auto' : '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
          transition: 'all 0.2s',
        }}>
          {isLast ? (
            <>
              {language === 'en' ? 'Start Chatting' : 'Comenzar'} <ArrowRight size={18} />
            </>
          ) : (
            <ChevronRight size={20} />
          )}
        </button>
      </div>

      {/* CSS Animations */}
      <style>{`
        .tutorial-slide-in {
          animation: tutorialFadeIn 0.25s ease-out;
        }
        .tutorial-slide-left {
          animation: tutorialSlideLeft 0.2s ease-in;
        }
        .tutorial-slide-right {
          animation: tutorialSlideRight 0.2s ease-in;
        }
        @keyframes tutorialFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tutorialSlideLeft {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-30px); }
        }
        @keyframes tutorialSlideRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(30px); }
        }
      `}</style>
    </div>
  );
}