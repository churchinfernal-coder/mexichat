import { useEffect, useRef } from 'react';
import { MessageEncryption } from '@/utils/encryption-enterprise';

export function useEncryptionInit(userId: string | undefined, userEmail: string | undefined) {
  const initRef = useRef(false);

  useEffect(() => {
    if (!userId || !userEmail || initRef.current) return;

    const init = async () => {
      try {
        await MessageEncryption.initialize(userId, userEmail);
        initRef.current = true;
        console.log('✅ [ENCRYPTION] Ready');
      } catch (error) {
        console.error('❌ [ENCRYPTION] Init failed:', error);
      }
    };

    init();
  }, [userId, userEmail]);

  return {
    isInitialized: MessageEncryption.isInitialized(),
    isEncrypted: MessageEncryption.isEncrypted,
  };
}