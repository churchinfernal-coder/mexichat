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
        <title>MexiChat - Mensajería Privada y Segura | Chat, Llamadas, Comunidad</title>
        <meta name="description" content="MexiChat: La app de mensajería privada de México para el mundo. Chat cifrado, llamadas de voz y video HD, grupos, pagos seguros y comunidad MexiVanza. Descarga gratis para Android, iOS y Web." />
        <meta name="keywords" content="mexichat, mensajería segura, chat privado, llamadas gratis, videollamadas HD, mensajería cifrada, chat mexico, app mexicana, mexivanza, comunidad mexicana, pagos móviles, chat encriptado, alternativa whatsapp" />
        <link rel="canonical" href="https://mexichat.app" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://mexichat.app" />
        <meta property="og:title" content="MexiChat - Mensajería Privada y Segura" />
        <meta property="og:description" content="Chat cifrado de extremo a extremo, llamadas HD, grupos y comunidad. La mensajería de México para el mundo." />
        <meta property="og:image" content="https://mexichat.app/web-app-manifest-512x512.png" />
        <meta property="og:locale" content="es_MX" />
        <meta property="og:site_name" content="MexiChat" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MexiChat - Mensajería Privada y Segura" />
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
          "description": "Mensajería privada y segura con cifrado de extremo a extremo. Llamadas de voz y video HD, grupos, pagos y comunidad.",
          "url": "https://mexichat.app",
          "downloadUrl": "https://mexichat.app/#download",
          "screenshot": "https://mexichat.app/web-app-manifest-512x512.png",
          "featureList": ["End-to-end encryption","Voice & video calls","Group chats","Mobile payments","Community feed","Cross-platform"]
        })}</script>
      </Helmet>

      <div className="landing">
        {/* -- NAV -- */}
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

        {/* -- HERO -- */}
        <header className={`landing-hero ${visible ? 'visible' : ''}`}>
          <div className="landing-hero-content">
            <div className="landing-hero-badge">{'\u{1F1F2}\u{1F1FD}'} Hecho en México para el mundo</div>
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
                      <div className="mock-back">{'\u2190'}</div>
                      <div className="mock-avatar-sm blue">M</div>
                      <div className="mock-header-info">
                        <span className="mock-header-name">María García</span>
                        <span className="mock-header-status">en línea</span>
                      </div>
                      <div className="mock-header-icons">
                        <span>{'\u{1F4DE}'}</span>
                        <span>{'\u{1F4F9}'}</span>
                      </div>
                    </div>
                    <div className="mock-chat-body">
                      <div className="mock-date-pill">{t.landing.mockChat.today}</div>
                      <div className="mock-bubble received">
                        <p>Hola! Ya llegaste? {'\u{1F44B}'}</p>
                        <span className="mock-time">10:30</span>
                      </div>
                      <div className="mock-bubble sent">
                        <p>Sí! Acabo de llegar al aeropuerto {'\u2708\uFE0F'}</p>
                        <span className="mock-time">10:31 {'\u2713\u2713'}</span>
                      </div>
                      <div className="mock-bubble received">
                        <p>Qué emoción!! {'\u{1F389}'} Te mando mi ubicación</p>
                        <span className="mock-time">10:31</span>
                      </div>
                      <div className="mock-bubble received">
                        <div className="mock-location">
                          <div className="mock-map">{'\u{1F4CD}'}</div>
                          <span>Ubicación compartida</span>
                        </div>
                        <span className="mock-time">10:32</span>
                      </div>
                      <div className="mock-bubble sent">
                        <p>Perfecto! Ya voy para allá {'\u{1F697}\u{1F4A8}'}</p>
                        <span className="mock-time">10:33 {'\u2713\u2713'}</span>
                      </div>
                      <div className="mock-bubble sent">
                        <div className="mock-voice">
                          <span>{'\u{1F3A4}'}</span>
                          <div className="mock-voice-wave" />
                          <span>0:12</span>
                        </div>
                        <span className="mock-time">10:34 {'\u2713\u2713'}</span>
                      </div>
                    </div>
                    <div className="mock-chat-input">
                      <span>{'\u{1F4CE}'}</span>
                      <div className="mock-input-field">{t.landing.mockChat.message}</div>
                      <div className="mock-send-btn">{'\u27A1\uFE0F'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* -- APP SCREENS SHOWCASE -- */}
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
                          <div className="mock-icon-circle blue">{'\u{1F4AC}'}</div>
                          <span>Chats</span>
                        </div>
                        <div className="mock-home-icon">
                          <div className="mock-icon-circle blue">{'\u{1F465}'}</div>
                          <span>Grupos</span>
                        </div>
                        <div className="mock-home-icon">
                          <div className="mock-icon-circle green">{'\u{1F4B2}'}</div>
                          <span>Pagos</span>
                        </div>
                        <div className="mock-home-icon">
                          <div className="mock-icon-circle purple">{'\u{1F30E}'}</div>
                          <span>{t.landing.footer.community}</span>
                        </div>
                      </div>
                      <div className="mock-home-settings">{'\u2699\uFE0F'}</div>
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
                        <span>{'\u270F\uFE0F'}</span>
                      </div>
                      <div className="mock-chatlist-search">{'\u{1F50D}'} Buscar...</div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm green">A</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Ana López</strong><span>12:45</span></div>
                          <span className="mock-preview">Nos vemos mañana! {'\u{1F389}'}</span>
                        </div>
                        <div className="mock-unread">3</div>
                      </div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm blue">C</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Carlos Ruiz</strong><span>11:20</span></div>
                          <span className="mock-preview">Te envié el archivo {'\u{1F4CE}'}</span>
                        </div>
                      </div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm orange">F</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Familia CDMX</strong><span>ayer</span></div>
                          <span className="mock-preview">Mamá: Los espero a las 3</span>
                        </div>
                        <div className="mock-unread">12</div>
                      </div>
                      <div className="mock-chatlist-item">
                        <div className="mock-avatar-sm purple">D</div>
                        <div className="mock-chatlist-info">
                          <div className="mock-chatlist-row"><strong>Diego M.</strong><span>ayer</span></div>
                          <span className="mock-preview">{'\u{1F3A4}'} Nota de voz (0:24)</span>
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
              <h3>{t.landing.screens.chats}</h3>
              <p>{t.landing.screens.chatsDesc}</p>
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
                            <span>hace 2 días</span>
                          </div>
                        </div>
                        <p className="mock-post-text">Veracruzzzz {'\u{1F929}'}</p>
                        <div className="mock-post-image">{'\u{1F3D6}\uFE0F'}</div>
                        <div className="mock-post-actions">
                          <span>{'\u2764\uFE0F'} 24</span>
                          <span>{'\u{1F4AC}'} 8</span>
                          <span>{'\u2197\uFE0F'} Compartir</span>
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
                          <span>{'\u{1F4E4}'}</span>
                          <small>{t.pagos.send}</small>
                        </div>
                        <div className="mock-pay-btn">
                          <span>{'\u{1F4E5}'}</span>
                          <small>{t.pagos.history}</small>
                        </div>
                        <div className="mock-pay-btn">
                          <span>{'\u{1F4C4}'}</span>
                          <small>{t.pagos.history}</small>
                        </div>
                      </div>
                      <div className="mock-transactions">
                        <div className="mock-tx">
                          <div className="mock-avatar-xs green">A</div>
                          <div><strong>Ana López</strong><br /><small>Ayer, 3:45 PM</small></div>
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

        {/* -- FEATURES -- */}
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

        {/* -- PRIVACY -- */}
        <section id="privacy" className={`landing-privacy ${isVisible('privacy') ? 'visible' : ''}`} data-animate>
          <div className="landing-privacy-inner">
            <div className="landing-privacy-shield">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <h2>{t.landing.privacy.title}</h2>
            <p>{t.landing.privacy.desc}</p>
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

                {/* -- DOWNLOAD -- */}
        <section id="download" className={`landing-download ${isVisible('download') ? 'visible' : ''}`} data-animate>
          <h2>{t.landing.download.title}</h2>
          <p className="landing-download-sub">{t.landing.download.subtitle}</p>
          <div className="landing-download-grid">

            {/* Android - ALL 4 options visible */}
            <div className="landing-download-card">
              <div className="landing-download-icon android">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              </div>
              <h3>Android</h3>
              <p>{t.landing.download.androidReq}</p>
              <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer" className="landing-store-btn google">
                {'\u25B6'} Google Play
              </a>
              <a href="/mexichat.apk" download="MexiChat.apk" className="landing-store-btn apk-direct">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {t.landing.download.downloadApk}
              </a>
              <a href="/mexichat.apk" download className="landing-download-link">
                {'\u2B07'} {t.landing.download.downloadApk}
              </a>
              <div className="landing-download-help">
                <details className="landing-apk-help">
                  <summary>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {lang === 'es' ? '¿Cómo instalar el APK?' : lang === 'ru' ? 'Как установить APK?' : lang === 'zh' ? '如何安装 APK？' : 'How to install the APK?'}
                  </summary>
                  <div className="landing-apk-steps">
                    <ol>
                      <li>{lang === 'es' ? 'Descarga el archivo APK tocando el botón verde de arriba' : lang === 'ru' ? 'Скачайте APK-файл, нажав зелёную кнопку выше' : lang === 'zh' ? '点击上方绿色按钮下载 APK 文件' : 'Download the APK file by tapping the green button above'}</li>
                      <li>{lang === 'es' ? 'Abre Ajustes → Seguridad → Habilita "Orígenes desconocidos"' : lang === 'ru' ? 'Откройте Настройки → Безопасность → Включите «Неизвестные источники»' : lang === 'zh' ? '打开设置 → 安全 → 启用"未知来源"' : 'Open Settings → Security → Enable "Unknown sources"'}</li>
                      <li>{lang === 'es' ? 'Abre el archivo descargado y toca "Instalar"' : lang === 'ru' ? 'Откройте загруженный файл и нажмите «Установить»' : lang === 'zh' ? '打开下载的文件并点击"安装"' : 'Open the downloaded file and tap "Install"'}</li>
                      <li>{lang === 'es' ? '¡Listo! Abre MexiChat y crea tu cuenta' : lang === 'ru' ? 'Готово! Откройте MexiChat и создайте аккаунт' : lang === 'zh' ? '完成！打开 MexiChat 并创建您的账户' : 'Done! Open MexiChat and create your account'}</li>
                    </ol>
                    <p className="landing-apk-note">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      {lang === 'es' ? 'El APK es seguro y firmado oficialmente por MexiVanza.' : lang === 'ru' ? 'APK безопасен и официально подписан MexiVanza.' : lang === 'zh' ? 'APK 安全且由 MexiVanza 官方签名。' : 'The APK is safe and officially signed by MexiVanza.'}
                    </p>
                  </div>
                </details>
              </div>
            </div>

            {/* iOS */}
            <div className="landing-download-card">
              <div className="landing-download-icon ios">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              </div>
              <h3>iOS</h3>
              <p>{t.landing.download.iosReq}</p>
              <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className="landing-store-btn apple">
                {'\uF8FF'} App Store
              </a>
            </div>

            {/* Web App */}
            <div className="landing-download-card">
              <div className="landing-download-icon web">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <h3>{t.landing.download.webApp}</h3>
              <p>{t.landing.download.anyBrowser}</p>
              <button className="landing-store-btn web" onClick={() => navigate('/auth')}>
                {'\u{1F310}'} {t.landing.download.openWebApp}
              </button>
            </div>
          </div>
        </section>
        {/* -- FOOTER -- */}
        <footer className="landing-footer" role="contentinfo">
          <div className="landing-footer-inner">
            <div className="landing-footer-brand">
              <div className="landing-footer-logo-row">
                <img src="/apple-touch-icon.png" alt="MexiChat" className="landing-footer-logo" width="40" height="40" />
                <span>Mexi<strong>Chat</strong></span>
              </div>
              <p>La mensajería de México para el mundo.<br/>Privada y segura, y siempre gratuita.</p>
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