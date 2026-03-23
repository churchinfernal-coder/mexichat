/**
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useTranslation, type Language } from '@/i18n';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import '@/styles/Landing.css';

const LANGS: { code: Language; flag: string; label: string }[] = [
  { code: 'es', flag: '\u{1F1F2}\u{1F1FD}', label: 'ES' },
  { code: 'en', flag: '\u{1F1FA}\u{1F1F8}', label: 'EN' },
  { code: 'ru', flag: '\u{1F1F7}\u{1F1FA}', label: 'RU' },
  { code: 'zh', flag: '\u{1F1E8}\u{1F1F3}', label: 'ZH' },
];

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('[data-animate]').forEach((el) => {
      observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const isVisible = (id: string) => visibleSections.has(id);

  return (
    <>
      <Helmet>
        <title>MexiChat - MensajerÃƒÆ’Ã‚Â­a Privada y Segura | Chat, Llamadas, Comunidad</title>
        <meta name="description" content="MexiChat: La app de mensajerÃƒÆ’Ã‚Â­a privada de MÃƒÆ’Ã‚Â©xico para el mundo. Chat cifrado, llamadas de voz y video HD, grupos, pagos seguros y comunidad MexiVanza. Descarga gratis para Android, iOS y Web." />
        <meta name="keywords" content="mexichat, mensajerÃƒÆ’Ã‚Â­a segura, chat privado, llamadas gratis, video llamadas HD, mensajerÃƒÆ’Ã‚Â­a cifrada, chat mexico, app mexicana, mexivanza, comunidad mexicana, pagos mÃƒÆ’Ã‚Â³viles, chat encriptado, alternativa whatsapp" />
        <link rel="canonical" href="https://mexichat.app" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://mexichat.app" />
        <meta property="og:title" content="MexiChat - MensajerÃƒÆ’Ã‚Â­a Privada y Segura" />
        <meta property="og:description" content="Chat cifrado de extremo a extremo, llamadas HD, grupos y comunidad. La mensajerÃƒÆ’Ã‚Â­a de MÃƒÆ’Ã‚Â©xico para el mundo." />
        <meta property="og:image" content="https://mexichat.app/web-app-manifest-512x512.png" />
        <meta property="og:locale" content="es_MX" />
        <meta property="og:site_name" content="MexiChat" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MexiChat - MensajerÃƒÆ’Ã‚Â­a Privada y Segura" />
        <meta name="twitter:description" content="Chat cifrado, llamadas HD, comunidad MexiVanza. Descarga gratis." />
        <meta name="twitter:image" content="https://mexichat.app/web-app-manifest-512x512.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MobileApplication",
          "name": "MexiChat",
          "operatingSystem": "Android, iOS",
          "applicationCategory": "CommunicationApplication",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "MXN" },
          "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "1200" },
          "description": "MensajerÃƒÆ’Ã‚Â­a privada y segura con cifrado de extremo a extremo. Llamadas de voz y video HD, grupos, pagos y comunidad.",
          "url": "https://mexichat.app",
          "downloadUrl": "https://mexichat.app/#download",
          "screenshot": "https://mexichat.app/web-app-manifest-512x512.png",
          "featureList": ["End-to-end encryption","Voice & video calls","Group chats","Mobile payments","Community feed","Cross-platform"]
        })}</script>
      </Helmet>

      <div className="landing">
        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ NAV ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <nav className={`landing-nav ${visible ? 'visible' : ''}`} role="navigation" aria-label="Main navigation">
          <div className="landing-nav-inner">
            <div className="landing-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src="/apple-touch-icon.png" alt="MexiChat Logo" className="landing-logo-icon" width="32" height="32" />
              <span>Mexi<strong>Chat</strong></span>
            </div>
            <div className="landing-nav-links">
              <button onClick={() => scrollTo('features')}>{t.landing.nav.features}</button>
              <button onClick={() => scrollTo('screens')}>{t.landing.nav.app}</button>
              <button onClick={() => scrollTo('privacy')}>{t.landing.nav.privacy}</button>
              <button onClick={() => scrollTo('download')}>{t.landing.nav.download}</button>
            </div>
            <button className="landing-nav-cta" onClick={() => navigate('/auth')}>
              {t.landing.nav.openApp}
            </button>
            <div className="landing-lang-toggle">
              {LANGS.map((l) => (
                <button key={l.code} onClick={() => setLang(l.code)}
                  className={`landing-lang-btn ${lang === l.code ? 'active' : ''}`}>
                  <span>{l.flag}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ HERO ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <header className={`landing-hero ${visible ? 'visible' : ''}`}>
          <div className="landing-hero-content">
            <div className="landing-hero-badge">ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¡Ã‚Â²ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¡Ã‚Â½ Hecho en MÃƒÆ’Ã‚Â©xico para el mundo</div>
            <h1>
              <span className="landing-hero-line1">{t.landing.hero.line1}</span>
              <span className="landing-hero-line2">{t.landing.hero.line2}</span>
            </h1>
            <p className="landing-hero-sub">
              {t.landing.hero.subtitle}
            </p>
            <div className="landing-hero-buttons">
              <button className="landing-btn-primary" onClick={() => scrollTo('download')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>{t.landing.hero.downloadFree}</button>
              <button className="landing-btn-secondary" onClick={() => navigate('/auth')}>
                {t.landing.hero.openBrowser}</button>
            </div>
            <div className="landing-hero-stats">
              <div className="landing-stat">
                <strong>100%</strong>
                <span>{t.landing.hero.e2eEncryption}</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <strong>{t.landing.hero.free}</strong>
                <span>{t.landing.hero.noAds}</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <strong>3</strong>
                <span>{t.landing.hero.platforms}</span>
              </div>
            </div>
          </div>
          <div className="landing-hero-visual">
            <div className="landing-phone" aria-hidden="true">
              <div className="landing-phone-frame">
                <div className="landing-phone-notch" />
                <div className="landing-phone-screen">
                  {/* CHAT MOCKUP */}
                  <div className="mock-chat">
                    <div className="mock-chat-header">
                      <div className="mock-back">ÃƒÂ¢Ã¢â‚¬Â Ã‚Â</div>
                      <div className="mock-avatar-sm blue">M</div>
                      <div className="mock-header-info">
                        <span className="mock-header-name">MarÃƒÆ’Ã‚Â­a GarcÃƒÆ’Ã‚Â­a</span>
                        <span className="mock-header-status">en lÃƒÆ’Ã‚Â­nea</span>
                      </div>
                      <div className="mock-header-icons">
                        <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â¾</span>
                        <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¹</span>
                      </div>
                    </div>
                    <div className="mock-chat-body">
                      <div className="mock-date-pill">{t.landing.mockChat.today}</div>
                      <div className="mock-bubble received">
                        <p>Hola! Ya llegaste? ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Â¹</p>
                        <span className="mock-time">10:30</span>
                      </div>
                      <div className="mock-bubble sent">
                        <p>SÃƒÆ’Ã‚Â­! Acabo de llegar al aeropuerto ÃƒÂ¢Ã…â€œÃ‹â€ ÃƒÂ¯Ã‚Â¸Ã‚Â</p>
                        <span className="mock-time">10:31 ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“</span>
                      </div>
                      <div className="mock-bubble received">
                        <p>QuÃƒÆ’Ã‚Â© emociÃƒÆ’Ã‚Â³n!! ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° Te mando mi ubicaciÃƒÆ’Ã‚Â³n</p>
                        <span className="mock-time">10:31</span>
                      </div>
                      <div className="mock-bubble received">
                        <div className="mock-location">
                          <div className="mock-map">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â</div>
                          <span>UbicaciÃƒÆ’Ã‚Â³n compartida</span>
                        </div>
                        <span className="mock-time">10:32</span>
                      </div>
                      <div className="mock-bubble sent">
                        <p>Perfecto! Ya voy para allÃƒÆ’Ã‚Â¡ ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â‚¬â€ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¨</p>
                        <span className="mock-time">10:33 ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“</span>
                      </div>
                      <div className="mock-bubble sent">
                        <div className="mock-voice">
                          <span>ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¤</span>
                          <div className="mock-voice-wave" />
                          <span>0:12</span>
                        </div>
                        <span className="mock-time">10:34 ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“</span>
                      </div>
                    </div>
                    <div className="mock-chat-input">
                      <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â½</span>
                      <div className="mock-input-field">{t.landing.mockChat.message}</div>
                      <div className="mock-send-btn">ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ APP SCREENS SHOWCASE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <section id="screens" className={`landing-screens ${isVisible('screens') ? 'visible' : ''}`} data-animate>
          <h2>{t.landing.screens.title}</h2>
          <p className="landing-screens-sub">{t.landing.screens.subtitle}</p>
          
          <div className="landing-screens-grid">
            {/* Screen 1: Home */}
            <div className="landing-screen-card">
              <div className="landing-phone-mini">
                <div className="landing-phone-frame mini">
                  <div className="landing-phone-notch" />
                  <div className="landing-phone-screen">
                    <div className="mock-home">
                      <div className="mock-home-title">Mexi<strong>Chat</strong></div>
                      <div className="mock-home-grid">
                        <div className="mock-home-icon">
                          <div className="mock-icon-circle blue">ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¬</div>
                          <span>Chats</span>
                        </div>
                        <div className="mock-home-icon">
                          <div className="mock-icon-circle blue">ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¥</div>
                          <span>Grupos</span>
                        </div>
                        <div className="mock-home-icon">
                          <div className="mock-icon-circle green">ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â²</div>
                          <span>Pagos</span>
                        </div>
                        <div className="mock-home-icon">
                          <div className="mock-icon-circle purple">ÃƒÂ°Ã…Â¸Ã…â€™Ã…Â½</div>
                          <span>{t.landing.footer.community}</span>
                        </div>
                      </div>
                      <div className="mock-home-settings">ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â</div>
                    </div>
                  </div>
                </div>
              </div>
              <h3>{t.landing.screens.title}</h3>
              <p>{t.landing.screens.subtitle}</p>
            </div>

            {/* Screen 2: Chat List */}
            <div className="landing-screen-card">
              <div className="landing-phone-mini">
                <div className="landing-phone-frame mini">
                  <div className="landing-phone-notch" />
                  <div className="landing-phone-screen">
                    <div className="mock-chatlist">
                      <div className="mock-chatlist-header">
                        <span className="mock-chatlist-title">{t.home.chats}</span>
                        <span>ÃƒÂ¢Ã…â€œÃ‚ÂÃƒÂ¯Ã‚Â¸Ã‚Â</span>
                      </div>
                      <div className="mock-chatlist-search">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Buscar...</div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm green">A</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Ana LÃƒÆ’Ã‚Â³pez</strong><span>12:45</span></div>
                          <span className="mock-preview">Nos vemos maÃƒÆ’Ã‚Â±ana! ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â°</span>
                        </div>
                        <div className="mock-unread">3</div>
                      </div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm blue">C</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Carlos Ruiz</strong><span>11:20</span></div>
                          <span className="mock-preview">Te enviÃƒÆ’Ã‚Â© el archivo ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾</span>
                        </div>
                      </div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm orange">F</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Familia CDMX</strong><span>ayer</span></div>
                          <span className="mock-preview">MamÃƒÆ’Ã‚Â¡: Los espero a las 3</span>
                        </div>
                        <div className="mock-unread">12</div>
                      </div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm purple">D</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Diego M.</strong><span>ayer</span></div>
                          <span className="mock-preview">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¤ Nota de voz (0:24)</span>
                        </div>
                      </div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm teal">T</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Trabajo MKT</strong><span>lun</span></div>
                          <span className="mock-preview">Junta a las 9am sin falta</span>
                        </div>
                        <div className="mock-unread">5</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <h3>Tus Conversaciones</h3>
              <p>Mensajes privados y grupos organizados con bÃƒÆ’Ã‚Âºsqueda instantÃƒÆ’Ã‚Â¡nea</p>
            </div>

            {/* Screen 3: Community */}
            <div className="landing-screen-card">
              <div className="landing-phone-mini">
                <div className="landing-phone-frame mini">
                  <div className="landing-phone-notch" />
                  <div className="landing-phone-screen">
                    <div className="mock-community">
                      <div className="mock-community-header">
                        <span>{t.landing.features.community.title}</span>
                      </div>
                      <div className="mock-community-tabs">
                        <span className="active">Social</span>
                        <span>MexiMart</span>
                        <span>Videos</span>
                        <span>Viajes</span>
                      </div>
                      <div className="mock-community-post">
                        <div className="mock-post-header">
                          <div className="mock-avatar-sm orange">D</div>
                          <div>
                            <strong>Diego Rodriguez</strong>
                            <span>hace 2 dÃƒÆ’Ã‚Â­as</span>
                          </div>
                        </div>
                        <p className="mock-post-text">Veracruzzzz ÃƒÂ°Ã…Â¸Ã‚Â¤Ã‚Â©</p>
                        <div className="mock-post-image">ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬â€œÃƒÂ¯Ã‚Â¸Ã‚Â</div>
                        <div className="mock-post-actions">
                          <span>ÃƒÂ¢Ã‚ÂÃ‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â 24</span>
                          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¬ 8</span>
                          <span>ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â€ÃƒÂ¯Ã‚Â¸Ã‚Â Compartir</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <h3>{t.landing.features.community.title}</h3>
              <p>{t.landing.features.community.desc}</p>
            </div>

            {/* Screen 4: Payments */}
            <div className="landing-screen-card">
              <div className="landing-phone-mini">
                <div className="landing-phone-frame mini">
                  <div className="landing-phone-notch" />
                  <div className="landing-phone-screen">
                    <div className="mock-payments">
                      <div className="mock-payments-header">
                        <span>{t.pagos.title}</span>
                      </div>
                      <div className="mock-balance">
                        <span>{t.pagos.account}</span>
                        <strong>$2,450.00 MXN</strong>
                      </div>
                      <div className="mock-pay-actions">
                        <div className="mock-pay-btn">
                          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¤</span>
                          <small>{t.pagos.send}</small>
                        </div>
                        <div className="mock-pay-btn">
                          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¥</span>
                          <small>{t.pagos.history}</small>
                        </div>
                        <div className="mock-pay-btn">
                          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â </span>
                          <small>{t.pagos.history}</small>
                        </div>
                      </div>
                      <div className="mock-transactions">
                        <div className="mock-tx">
                          <div className="mock-avatar-xs green">A</div>
                          <div><strong>Ana LÃƒÆ’Ã‚Â³pez</strong><br /><small>Ayer, 3:45 PM</small></div>
                          <span className="mock-tx-amount positive">+$500</span>
                        </div>
                        <div className="mock-tx">
                          <div className="mock-avatar-xs blue">C</div>
                          <div><strong>Carlos R.</strong><br /><small>Mar, 1:20 PM</small></div>
                          <span className="mock-tx-amount negative">-$150</span>
                        </div>
                        <div className="mock-tx">
                          <div className="mock-avatar-xs purple">M</div>
                          <div><strong>MexiMart</strong><br /><small>Lun, 10:00 AM</small></div>
                          <span className="mock-tx-amount negative">-$320</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <h3>{t.landing.features.payments.title}</h3>
              <p>{t.landing.features.payments.desc}</p>
            </div>
          </div>
        </section>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ FEATURES ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <section id="features" className={`landing-features ${isVisible('features') ? 'visible' : ''}`} data-animate>
          <h2>{t.landing.features.title}</h2>
          <p className="landing-features-sub">{t.landing.features.subtitle}</p>
          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon blue">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3>{t.landing.features.e2e.title}</h3>
              <p>{t.landing.features.e2e.desc}</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon green">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>{t.home.groups}</h3>
              <p>{t.landing.features.multiplatform.desc}</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon purple">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <h3>{t.landing.features.calls.title}</h3>
              <p>{t.landing.features.calls.desc}</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon orange">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <h3>{t.landing.features.community.title}</h3>
              <p>{t.landing.features.community.desc}</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon teal">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h3>{t.landing.features.payments.title}</h3>
              <p>{t.landing.features.payments.desc}</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon rose">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <h3>{t.landing.features.multiplatform.title}</h3>
              <p>{t.landing.features.multiplatform.desc}</p>
            </div>
          </div>
        </section>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ PRIVACY ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <section id="privacy" className={`landing-privacy ${isVisible('privacy') ? 'visible' : ''}`} data-animate>
          <div className="landing-privacy-inner">
            <div className="landing-privacy-shield">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <h2>{t.landing.privacy.title}</h2>
            <p>
              {t.landing.privacy.desc}

            </p>
            <div className="landing-privacy-badges">
              <div className="landing-privacy-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {t.landing.privacy.e2e}
              </div>
              <div className="landing-privacy-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {t.landing.privacy.noTracking}
              </div>
              <div className="landing-privacy-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {t.landing.privacy.noAds}
              </div>
              <div className="landing-privacy-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {t.landing.privacy.noDataSale}
              </div>
            </div>
          </div>
        </section>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ DOWNLOAD ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <section id="download" className={`landing-download ${isVisible('download') ? 'visible' : ''}`} data-animate>
          <h2>{t.landing.download.title}</h2>
          <p className="landing-download-sub">{t.landing.download.subtitle}</p>
          <div className="landing-download-grid">
            <div className="landing-download-card">
              <div className="landing-download-icon android">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              </div>
              <h3>Android</h3>
              <p>{t.landing.download.androidReq}</p>
              <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer" className="landing-store-btn google">
                ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¶ Google Play
              </a>
              <a href="/mexichat.apk" download className="landing-download-link">
                ÃƒÂ¢Ã‚Â¬Ã¢â‚¬Â¡ {t.landing.download.downloadApk}
              </a>
            </div>
            <div className="landing-download-card">
              <div className="landing-download-icon ios">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              </div>
              <h3>iOS</h3>
              <p>{t.landing.download.iosReq}</p>
              <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className="landing-store-btn apple">
                 App Store
              </a>
            </div>
            <div className="landing-download-card">
              <div className="landing-download-icon web">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <h3>{t.landing.download.webApp}</h3>
              <p>{t.landing.download.anyBrowser}</p>
              <button className="landing-store-btn web" onClick={() => navigate('/auth')}>
                ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â {t.landing.download.openWebApp}
              </button>
            </div>
          </div>
        </section>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ FOOTER ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <footer className="landing-footer" role="contentinfo">
          <div className="landing-footer-inner">
            <div className="landing-footer-brand">
              <div className="landing-footer-logo-row">
                <img src="/apple-touch-icon.png" alt="MexiChat" className="landing-footer-logo" width="40" height="40" />
                <span>Mexi<strong>Chat</strong></span>
              </div>
              <p>La mensajerÃƒÆ’Ã‚Â­a de MÃƒÆ’Ã‚Â©xico para el mundo.<br/>Privada, segura, y siempre gratuita.</p>
            </div>
            <div className="landing-footer-links">
              <div className="landing-footer-col">
                <h4>App</h4>
                <button onClick={() => scrollTo('features')}>{t.landing.nav.features}</button>
                <button onClick={() => scrollTo('screens')}>{t.landing.footer.screenshots}</button>
                <button onClick={() => scrollTo('download')}>{t.landing.nav.download}</button>
                <button onClick={() => navigate('/auth')}>{t.landing.download.webApp}</button>
              </div>
              <div className="landing-footer-col">
                <h4>{t.landing.footer.legal}</h4>
                <button onClick={() => navigate("/privacidad")}>{t.landing.footer.privacyPolicy}</button>
                <button onClick={() => navigate("/terminos")}>{t.landing.footer.terms}</button>
              </div>
              <div className="landing-footer-col">
                <h4>{t.landing.footer.community}</h4>
                <a href="https://mexivanza.com" target="_blank" rel="noopener noreferrer">MexiVanza</a>
                <a href="mailto:soporte@mexichat.app">{t.landing.footer.support}</a>
              </div>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <p>&copy; {new Date().getFullYear()} MexiChat. {t.landing.footer.allRights}</p>
            <p>{t.landing.footer.productOf} <a href="https://mexivanza.com" target="_blank" rel="noopener noreferrer">MexiVanza</a></p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Landing;
