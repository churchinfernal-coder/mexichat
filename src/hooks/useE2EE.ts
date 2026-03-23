import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  savePrivateKeyLocally,
  loadPrivateKeyLocally,
  isE2EESupported,
} from '@/utils/encryption';

interface E2EEHook {
  encrypt: (plaintext: string, recipientId: string) => Promise<{ ciphertext: string; iv: string } | null>;
  decrypt: (ciphertext: string, iv: string, senderId: string) => Promise<string | null>;
  isReady: boolean;
  isSupported: boolean;
  myPublicKey: string | null;
}

export function useE2EE(myUserId: string | undefined): E2EEHook {
  const [isReady, setIsReady] = useState(false);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const sharedKeyCacheRef = useRef(new Map<string, CryptoKey>());
  const publicKeyCacheRef = useRef(new Map<string, CryptoKey>());
  const supported = isE2EESupported();

  useEffect(() => {
    if (!myUserId || !supported) return;
    let cancelled = false;

    const init = async () => {
      try {
        const storedJwk = loadPrivateKeyLocally();
        if (storedJwk) {
          privateKeyRef.current = await importPrivateKey(storedJwk);

          // Fetch public key from DB — use raw query to avoid type issues
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', myUserId)
            .single();

          const row = data as unknown as Record<string, unknown> | null;
          if (row?.public_key && !cancelled) {
            setMyPublicKey(row.public_key as string);
            setIsReady(true);
            return;
          }
        }

        const { publicKey, privateKey } = await generateKeyPair();
        privateKeyRef.current = privateKey;

        const pubKeyStr = await exportPublicKey(publicKey);
        const privKeyStr = await exportPrivateKey(privateKey);

        savePrivateKeyLocally(privKeyStr);

        // Update profile — cast to bypass generated types
        await (supabase
          .from('profiles') as unknown as { update: (vals: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> } })
          .update({ public_key: pubKeyStr })
          .eq('id', myUserId);

        if (!cancelled) {
          setMyPublicKey(pubKeyStr);
          setIsReady(true);
        }
      } catch (err) {
        console.warn('E2EE init failed:', err);
        if (!cancelled) setIsReady(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [myUserId, supported]);

  const getSharedKey = useCallback(async (otherUserId: string): Promise<CryptoKey | null> => {
    if (!privateKeyRef.current) return null;

    const cached = sharedKeyCacheRef.current.get(otherUserId);
    if (cached) return cached;

    let theirPubKey = publicKeyCacheRef.current.get(otherUserId);
    if (!theirPubKey) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();

      const row = data as unknown as Record<string, unknown> | null;
      if (!row?.public_key) return null;
      theirPubKey = await importPublicKey(row.public_key as string);
      publicKeyCacheRef.current.set(otherUserId, theirPubKey);
    }

    const shared = await deriveSharedKey(privateKeyRef.current, theirPubKey);
    sharedKeyCacheRef.current.set(otherUserId, shared);
    return shared;
  }, []);

  const encrypt = useCallback(async (
    plaintext: string,
    recipientId: string
  ): Promise<{ ciphertext: string; iv: string } | null> => {
    if (!isReady || !supported) return null;
    try {
      const key = await getSharedKey(recipientId);
      if (!key) return null;
      return encryptMessage(plaintext, key);
    } catch (err) {
      console.warn('E2EE encrypt failed:', err);
      return null;
    }
  }, [isReady, supported, getSharedKey]);

  const decrypt = useCallback(async (
    ciphertext: string,
    iv: string,
    senderId: string
  ): Promise<string | null> => {
    if (!isReady || !supported) return null;
    try {
      const key = await getSharedKey(senderId);
      if (!key) return null;
      return decryptMessage(ciphertext, iv, key);
    } catch (err) {
      console.warn('E2EE decrypt failed:', err);
      return null;
    }
  }, [isReady, supported, getSharedKey]);

  return { encrypt, decrypt, isReady, isSupported: supported, myPublicKey };
}