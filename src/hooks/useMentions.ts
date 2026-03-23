import { useState, useCallback, useRef } from 'react';
import type { GroupMember } from '@/utils/messageMappers';

export interface MentionSuggestion {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

export function useMentions(members: GroupMember[]) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [mentionQuery, setMentionQuery] = useState('');

  const checkForMention = useCallback((text: string, cursorPos: number) => {
    // Find the last @ before cursor that isn't preceded by a word character
    const beforeCursor = text.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/(^|[^a-zA-Z0-9])@([a-zA-Z0-9_]*)$/);

    if (atMatch) {
      const query = atMatch[2].toLowerCase();
      setMentionStart(cursorPos - query.length - 1); // position of @
      setMentionQuery(query);

      const filtered = members
        .map(m => ({
          userId: m.userId,
          displayName: m.displayName,
          username: m.username ?? null,
          avatarUrl: m.avatarUrl ?? null,
        }))
        .filter(m =>
          m.displayName.toLowerCase().includes(query) ||
          (m.username && m.username.toLowerCase().includes(query))
        )
        .slice(0, 8);

      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [members]);

  const applyMention = useCallback((text: string, cursorPos: number, suggestion: MentionSuggestion): { newText: string; newCursor: number } => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursorPos);
    const mentionText = `@${suggestion.username || suggestion.displayName.replace(/\s/g, '_')} `;
    const newText = before + mentionText + after;
    const newCursor = before.length + mentionText.length;

    setShowSuggestions(false);
    setSuggestions([]);
    return { newText, newCursor };
  }, [mentionStart]);

  const extractMentions = useCallback((text: string): string[] => {
    const matches = text.match(/@([a-zA-Z0-9_]+)/g);
    if (!matches) return [];
    return matches.map(m => m.slice(1));
  }, []);

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
  }, []);

  return { suggestions, showSuggestions, mentionQuery, checkForMention, applyMention, extractMentions, closeSuggestions };
}