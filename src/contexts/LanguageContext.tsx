/**
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'es' | 'en' | 'zh' | 'ru';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const STORAGE_KEY = 'mc_language';
const VALID_LANGS: Language[] = ['es', 'en', 'zh', 'ru'];

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Language;
    if (stored && VALID_LANGS.includes(stored)) return stored;
  } catch {}

  // Auto-detect from browser
  const browserLang = navigator.language?.toLowerCase() || '';
  if (browserLang.startsWith('zh')) return 'zh';
  if (browserLang.startsWith('ru')) return 'ru';
  if (browserLang.startsWith('en')) return 'en';
  return 'es';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    // Update document lang attribute for SEO/accessibility
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  };

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};