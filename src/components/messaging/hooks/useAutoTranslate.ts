/**
 * MEXICHAT - Auto-Translate Messages v1.0
 * Detects message language and offers inline translation.
 * Uses free LibreTranslate-compatible API or browser fallback.
 */

import { useState, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLang: string;
  targetLang: string;
}

type TranslationCache = Map<string, TranslationResult>;

// ═══════════════════════════════════════════════════════════
// LANGUAGE DETECTION (client-side heuristic)
// ═══════════════════════════════════════════════════════════

const LANG_PATTERNS: Array<{ lang: string; label: string; pattern: RegExp }> = [
  { lang: 'es', label: 'Espanol', pattern: /\b(que|por|para|como|esta|pero|con|una|los|las|del|hay|ser|mas|sin|sobre|tiene|puede|hace|este|esta|donde|quien|cuando|porque|entre|desde|hasta|tambien|siempre|nunca|todos|nada|algo|mucho|poco)\b/gi },
  { lang: 'en', label: 'English', pattern: /\b(the|and|you|that|was|for|are|but|not|with|this|have|from|they|been|said|each|which|their|will|other|about|many|then|them|would|make|like|just|over|such|also|back|after|into|could|only|come|its|than|first|been|long|very|when|what|your|there)\b/gi },
  { lang: 'ru', label: 'Ruso', pattern: /[\u0400-\u04FF]/g },
  { lang: 'zh', label: 'Chino', pattern: /[\u4E00-\u9FFF]/g },
  { lang: 'ar', label: 'Arabe', pattern: /[\u0600-\u06FF]/g },
  { lang: 'pt', label: 'Portugues', pattern: /\b(voce|isso|nao|uma|com|para|como|mas|mais|tambem|muito|essa|este|pela|pelo|pode|fazer|tem|sao|foi|onde|quando|porque)\b/gi },
  { lang: 'fr', label: 'Frances', pattern: /\b(les|des|une|est|que|pas|pour|dans|sur|avec|sont|tout|plus|fait|cette|mais|comme|aussi|bien|encore|donc|etre|avoir|peut)\b/gi },
  { lang: 'de', label: 'Aleman', pattern: /\b(und|der|die|das|ist|ein|eine|nicht|mit|auf|den|dem|des|sich|von|auch|noch|nach|bei|aus|wie|wenn|nur|aber|als|kann)\b/gi },
  { lang: 'ja', label: 'Japones', pattern: /[\u3040-\u30FF\u31F0-\u31FF]/g },
  { lang: 'ko', label: 'Coreano', pattern: /[\uAC00-\uD7AF]/g },
];

function detectLanguage(text: string): { lang: string; label: string; confidence: number } {
  if (!text || text.length < 3) return { lang: 'unknown', label: 'Desconocido', confidence: 0 };

  const cleaned = text.replace(/https?:\/\/\S+/g, '').replace(/[^\w\s\u0080-\uFFFF]/g, '').trim();
  if (cleaned.length < 3) return { lang: 'unknown', label: 'Desconocido', confidence: 0 };

  let bestLang = 'unknown';
  let bestLabel = 'Desconocido';
  let bestScore = 0;

  for (const { lang, label, pattern } of LANG_PATTERNS) {
    const matches = cleaned.match(pattern);
    const score = matches ? matches.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
      bestLabel = label;
    }
  }

  const words = cleaned.split(/\s+/).length;
  const confidence = words > 0 ? Math.min(bestScore / words, 1) : 0;

  return { lang: bestLang, label: bestLabel, confidence };
}

// ═══════════════════════════════════════════════════════════
// TRANSLATION ENGINE
// ═══════════════════════════════════════════════════════════

const TRANSLATE_ENDPOINTS = [
  'https://api.mymemory.translated.net/get',
];

async function translateText(text: string, from: string, to: string): Promise<string> {
  // MyMemory API (free, no key required, 5000 chars/day)
  try {
    const langPair = from + '|' + to;
    const url = TRANSLATE_ENDPOINTS[0] + '?q=' + encodeURIComponent(text.slice(0, 500)) + '&langpair=' + encodeURIComponent(langPair);
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        // MyMemory returns UPPERCASED text sometimes, normalize it
        if (translated === translated.toUpperCase() && text !== text.toUpperCase()) {
          return translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
        }
        return translated;
      }
    }
  } catch {
    // fallback below
  }

  return '[Traduccion no disponible]';
}

// ═══════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════

export function useAutoTranslate(userLang = 'es') {
  const [translations, setTranslations] = useState<Map<string, TranslationResult>>(new Map());
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  const cache = useRef<TranslationCache>(new Map());

  const getDetectedLanguage = useCallback((text: string) => {
    return detectLanguage(text);
  }, []);

  const shouldOfferTranslation = useCallback((text: string): boolean => {
    if (!text || text.length < 10) return false;
    const detected = detectLanguage(text);
    // Only offer if detected language differs from user language and confidence is decent
    return detected.lang !== 'unknown' && detected.lang !== userLang && detected.confidence > 0.3;
  }, [userLang]);

  const translateMessage = useCallback(async (msgId: string, text: string) => {
    // Check cache first
    const cacheKey = msgId + ':' + userLang;
    if (cache.current.has(cacheKey)) {
      setTranslations(prev => new Map(prev).set(msgId, cache.current.get(cacheKey)!));
      return;
    }

    setTranslating(prev => new Set(prev).add(msgId));
    try {
      const detected = detectLanguage(text);
      const translated = await translateText(text, detected.lang, userLang);
      const result: TranslationResult = {
        originalText: text,
        translatedText: translated,
        detectedLang: detected.lang,
        targetLang: userLang,
      };
      cache.current.set(cacheKey, result);
      setTranslations(prev => new Map(prev).set(msgId, result));
    } finally {
      setTranslating(prev => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }
  }, [userLang]);

  const removeTranslation = useCallback((msgId: string) => {
    setTranslations(prev => {
      const next = new Map(prev);
      next.delete(msgId);
      return next;
    });
  }, []);

  const getTranslation = useCallback((msgId: string): TranslationResult | null => {
    return translations.get(msgId) || null;
  }, [translations]);

  const isTranslating = useCallback((msgId: string): boolean => {
    return translating.has(msgId);
  }, [translating]);

  return {
    shouldOfferTranslation,
    translateMessage,
    removeTranslation,
    getTranslation,
    isTranslating,
    getDetectedLanguage,
  };
}