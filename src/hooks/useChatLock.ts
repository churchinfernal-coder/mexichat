import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const PIN_KEY = 'mc_chat_lock_pin';
const LOCKED_KEY = 'mc_chat_locked';

export function useChatLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    const pin = localStorage.getItem(PIN_KEY);
    setHasPin(!!pin);
    if (pin) {
      const locked = sessionStorage.getItem(LOCKED_KEY);
      setIsLocked(locked !== 'unlocked');
      if (locked !== 'unlocked') setShowUnlock(true);
    }
  }, []);

  const setupPin = useCallback((pin: string) => {
    if (pin.length < 4) { toast.error('PIN debe tener al menos 4 dígitos'); return false; }
    // Hash with a simple approach (use bcrypt or similar in production)
    const hashed = btoa(pin + '_mc_salt');
    localStorage.setItem(PIN_KEY, hashed);
    setHasPin(true);
    sessionStorage.setItem(LOCKED_KEY, 'unlocked');
    setIsLocked(false);
    setShowSetup(false);
    toast.success('PIN configurado');
    return true;
  }, []);

  const unlock = useCallback((pin: string): boolean => {
    const stored = localStorage.getItem(PIN_KEY);
    const hashed = btoa(pin + '_mc_salt');
    if (hashed === stored) {
      sessionStorage.setItem(LOCKED_KEY, 'unlocked');
      setIsLocked(false);
      setShowUnlock(false);
      return true;
    }
    toast.error('PIN incorrecto');
    return false;
  }, []);

  const lock = useCallback(() => {
    if (!hasPin) return;
    sessionStorage.removeItem(LOCKED_KEY);
    setIsLocked(true);
    setShowUnlock(true);
  }, [hasPin]);

  const removePin = useCallback(() => {
    localStorage.removeItem(PIN_KEY);
    sessionStorage.removeItem(LOCKED_KEY);
    setHasPin(false);
    setIsLocked(false);
    toast.success('PIN eliminado');
  }, []);

  return { isLocked, hasPin, showSetup, showUnlock, setShowSetup, setShowUnlock, setupPin, unlock, lock, removePin };
}