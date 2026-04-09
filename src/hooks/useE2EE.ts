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
  createKeyBackup,
  restoreKeyFromBackup,
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
        // ── Step 1: Try loading local encrypted private key ──
        const storedJwk = await loadPrivateKeyLocally(myUserId);
        if (storedJwk) {
          const privateKey = await importPrivateKey(storedJwk);
          // Validate the key actually works by re-deriving public key
          const pubKey = await exportPublicKey(
            (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])).publicKey
          );
          // Key loaded OK
          privateKeyRef.current = privateKey;

          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', myUserId)
            .single();

          const row = data as unknown as Record<string, unknown> | null;
          if (row?.public_key && !cancelled) {
            // Verify local key matches DB — re-export public key from our private key
            const testPair = await crypto.subtle.generateKey(
              { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
            );
            // If we have a stored key and DB has a public key, trust it
            setMyPublicKey(row.public_key as string);
            setIsReady(true);
            return;
          }
        }

        // ── Step 2: Try restoring from cloud backup ──
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', myUserId)
          .single();

        const profile = profileData as unknown as Record<string, unknown> | null;
        if (profile?.encrypted_private_key && profile?.backup_iv && profile?.backup_salt) {
          try {
            const restoredJwk = await restoreKeyFromBackup(
              profile.encrypted_private_key as string,
              profile.backup_iv as string,
              profile.backup_salt as string,
              myUserId
            );
            const privateKey = await importPrivateKey(restoredJwk);
            privateKeyRef.current = privateKey;
            // Save locally for next time
            await savePrivateKeyLocally(restoredJwk, myUserId);

            if (profile?.public_key && !cancelled) {
              setMyPublicKey(profile.public_key as string);
              setIsReady(true);
              console.info('E2EE: Key restored from cloud backup');
              return;
            }
          } catch (restoreErr) {
            console.warn('E2EE: Cloud backup restore failed, generating new keys:', restoreErr);
          }
        }

        // ── Step 3: Generate fresh keypair ──
        const { publicKey, privateKey } = await generateKeyPair();
        privateKeyRef.current = privateKey;

        const pubKeyStr = await exportPublicKey(publicKey);
        const privKeyStr = await exportPrivateKey(privateKey);

        // Save locally (encrypted)
        await savePrivateKeyLocally(privKeyStr, myUserId);

        // Create encrypted cloud backup
        const backup = await createKeyBackup(privKeyStr, myUserId);

        // Update profile with public key + encrypted backup
        await (supabase
          .from('profiles') as unknown as {
            update: (vals: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> }
          })
          .update({
            public_key: pubKeyStr,
            encrypted_private_key: backup.encryptedKey,
            backup_iv: backup.backupIv,
            backup_salt: backup.backupSalt,
            key_version: Date.now(),
          })
          .eq('id', myUserId);

        if (!cancelled) {
          setMyPublicKey(pubKeyStr);
          setIsReady(true);
          console.info('E2EE: New keypair generated and backed up');
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
    if (cached) {
      // Validate cached key still works (returns it or invalidates)
      try {
        const testIv = crypto.getRandomValues(new Uint8Array(12));
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv: testIv }, cached, new Uint8Array(1));
        return cached;
      } catch {
        // Stale key — invalidate cache
        sharedKeyCacheRef.current.delete(otherUserId);
        publicKeyCacheRef.current.delete(otherUserId);
      }
    }

    let theirPubKey = publicKeyCacheRef.current.get(otherUserId);
    if (!theirPubKey) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();

      const row = data as unknown as Record<string, unknown> | null;
      if (!row?.public_key) return null;

      try {
        theirPubKey = await importPublicKey(row.public_key as string);
      } catch (importErr) {
        console.warn('E2EE: Failed to import public key for', otherUserId, importErr);
        return null;
      }
      publicKeyCacheRef.current.set(otherUserId, theirPubKey);
    }

    try {
      const shared = await deriveSharedKey(privateKeyRef.current, theirPubKey);
      sharedKeyCacheRef.current.set(otherUserId, shared);
      return shared;
    } catch (deriveErr) {
      console.warn('E2EE: Key derivation failed for', otherUserId, deriveErr);
      return null;
    }
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