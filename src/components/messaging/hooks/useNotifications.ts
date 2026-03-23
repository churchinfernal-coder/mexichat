/**
 * MEXICHAT — Notification Permission Helper v2
 * 
 * This hook is now ONLY responsible for requesting browser notification permission.
 * All actual notification handling is done by NotificationProvider.
 * 
 * The old orphaned `notifications:{userId}` channel (BUG-9) has been REMOVED.
 */

import { useEffect, useRef, useCallback } from 'react';

export function useNotifications(userId: string | undefined) {
  const permissionRef = useRef<NotificationPermission>('default');

  useEffect(() => {
    if (!userId) return;
    if ('Notification' in window) {
      permissionRef.current = Notification.permission;
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          permissionRef.current = perm;
        }).catch(() => {});
      }
    }
  }, [userId]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied';
    const perm = await Notification.requestPermission();
    permissionRef.current = perm;
    return perm;
  }, []);

  return {
    permission: permissionRef.current,
    requestPermission,
  };
}