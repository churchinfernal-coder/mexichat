/**
 * MexiChat — Tutorial state management hook
 * Tracks whether the user has seen the current tutorial version.
 * Bump TUTORIAL_VERSION after major updates to re-trigger.
 */
import { useState, useCallback } from 'react';

const TUTORIAL_VERSION = 2;
const STORAGE_KEY = 'mexichat_tutorial_seen_v';

export function useTutorial(userId: string | undefined) {
  const [shouldShow, setShouldShow] = useState<boolean>(() => {
    if (!userId) return false;
    const seen = localStorage.getItem(STORAGE_KEY + userId);
    return seen !== String(TUTORIAL_VERSION);
  });

  const dismiss = useCallback((): void => {
    if (userId) {
      localStorage.setItem(STORAGE_KEY + userId, String(TUTORIAL_VERSION));
    }
    setShouldShow(false);
  }, [userId]);

  /** Call this from Profile > Help > Tutorial to re-watch */
  const trigger = useCallback((): void => setShouldShow(true), []);

  return { shouldShow, dismiss, trigger } as const;
}