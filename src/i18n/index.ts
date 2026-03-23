/**
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */
/**
 * useTranslation â€” Central translation hook
 * Usage: const { t, lang, setLang } = useTranslation();
 */
import { useLanguage } from '@/contexts/LanguageContext';
import translations, { type Language, type Translations } from './translations';

export function useTranslation() {
  const { language, setLanguage } = useLanguage();
  const t: Translations = translations[language] || translations.es;

  return {
    t,
    lang: language as Language,
    setLang: setLanguage as (lang: Language) => void,
  };
}

export type { Language, Translations };
export { translations };