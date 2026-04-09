/**
 * MEXICHAT — useReminders hook v2.0
 * Enterprise-grade reminder system with CRUD, realtime alerts,
 * 5-minute early warnings, browser notifications, and repeat scheduling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playNotificationSound } from '@/utils/sounds';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface Reminder {
  id: string;
  userId: string;
  conversationId: string | null;
  groupId: string | null;
  title: string;
  note: string | null;
  remindAt: string;
  isFired: boolean;
  isDismissed: boolean;
  repeatMode: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: string;
}

export interface CreateReminderOpts {
  title: string;
  note?: string;
  remindAt: Date;
  conversationId?: string;
  groupId?: string;
  repeatMode?: Reminder['repeatMode'];
}

// ═══════════════════════════════════════════════════════════
// DB ROW MAPPER
// ═══════════════════════════════════════════════════════════

function mapReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    conversationId: (row.conversation_id as string) || null,
    groupId: (row.group_id as string) || null,
    title: row.title as string,
    note: (row.note as string) || null,
    remindAt: row.remind_at as string,
    isFired: row.is_fired as boolean,
    isDismissed: row.is_dismissed as boolean,
    repeatMode: (row.repeat_mode as Reminder['repeatMode']) || 'none',
    createdAt: row.created_at as string,
  };
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const TICK_INTERVAL_MS = 10_000;
const EARLY_WARNING_MINUTES = 5;
const EARLY_WARNING_TOAST_DURATION = 8_000;
const MAX_REMINDERS = 100;
const MS_PER_DAY = 86_400_000;

// ═══════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════

export function useReminders(userId: string | undefined) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAlert, setActiveAlert] = useState<Reminder | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const firedIds = useRef(new Set<string>());
  const earlyWarned = useRef(new Set<string>());

  // ─── LOAD ───────────────────────────────────────────────

  const loadReminders = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await (supabase
        .from('chat_reminders' as any)
        .select('*') as any)
        .eq('user_id', userId)
        .eq('is_dismissed', false)
        .order('remind_at', { ascending: true })
        .limit(MAX_REMINDERS);
      if (data) {
        setReminders((data as any[]).map(mapReminder));
      }
    } catch (err) {
      console.error('[Reminders] Load failed:', err);
    }
    setLoading(false);
  }, [userId]);

  // ─── CREATE ─────────────────────────────────────────────

  const createReminder = useCallback(async (opts: CreateReminderOpts) => {
    if (!userId) return null;
    const insert: Record<string, unknown> = {
      user_id: userId,
      title: opts.title,
      note: opts.note || null,
      remind_at: opts.remindAt.toISOString(),
      conversation_id: opts.conversationId || null,
      group_id: opts.groupId || null,
      repeat_mode: opts.repeatMode || 'none',
    };
    const { data, error } = await (supabase
      .from('chat_reminders' as any)
      .insert(insert as any) as any)
      .select('*')
      .single();
    if (error) {
      toast.error('Error al crear recordatorio');
      return null;
    }
    const reminder = mapReminder(data as Record<string, unknown>);
    setReminders(prev =>
      [...prev, reminder].sort(
        (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
      )
    );
    toast.success('Recordatorio creado');
    return reminder;
  }, [userId]);

  // ─── DISMISS ────────────────────────────────────────────

  const dismissReminder = useCallback(async (id: string) => {
    await (supabase
      .from('chat_reminders' as any)
      .update({ is_dismissed: true } as any) as any)
      .eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
    setActiveAlert(prev => (prev?.id === id ? null : prev));
    firedIds.current.delete(id);
  }, []);

  // ─── SNOOZE ─────────────────────────────────────────────

  const snoozeReminder = useCallback(async (id: string, minutes = 10) => {
    const newTime = new Date(Date.now() + minutes * 60_000).toISOString();
    await (supabase
      .from('chat_reminders' as any)
      .update({ remind_at: newTime, is_fired: false } as any) as any)
      .eq('id', id);
    setReminders(prev =>
      prev.map(r => (r.id === id ? { ...r, remindAt: newTime, isFired: false } : r))
    );
    setActiveAlert(prev => (prev?.id === id ? null : prev));
    firedIds.current.delete(id);
    earlyWarned.current.delete(id);
    toast.success('Pospuesto ' + minutes + ' minutos');
  }, []);

  // ─── DELETE ─────────────────────────────────────────────

  const deleteReminder = useCallback(async (id: string) => {
    await (supabase
      .from('chat_reminders' as any)
      .delete() as any)
      .eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
    setActiveAlert(prev => (prev?.id === id ? null : prev));
    firedIds.current.delete(id);
    earlyWarned.current.delete(id);
  }, []);

  // ─── REPEAT HANDLER ─────────────────────────────────────

  const handleRepeat = useCallback(async (reminder: Reminder) => {
    if (reminder.repeatMode === 'none') return;
    const current = new Date(reminder.remindAt);
    let next: Date;
    switch (reminder.repeatMode) {
      case 'daily':
        next = new Date(current.getTime() + MS_PER_DAY);
        break;
      case 'weekly':
        next = new Date(current.getTime() + 7 * MS_PER_DAY);
        break;
      case 'monthly':
        next = new Date(current);
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        return;
    }
    await (supabase
      .from('chat_reminders' as any)
      .update({ remind_at: next.toISOString(), is_fired: false } as any) as any)
      .eq('id', reminder.id);
    setReminders(prev =>
      prev.map(r =>
        r.id === reminder.id
          ? { ...r, remindAt: next.toISOString(), isFired: false }
          : r
      )
    );
  }, []);

  // ─── FIRE BROWSER NOTIFICATION ──────────────────────────

  const fireBrowserNotification = useCallback((reminder: Reminder) => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(reminder.title, {
          body: reminder.note || 'Recordatorio de MexiChat',
          icon: '/icon-192.png',
          tag: 'reminder-' + reminder.id,
          requireInteraction: true,
        });
      }
    } catch {
      // Browser notification not supported or blocked — silent fail
    }
  }, []);

  // ─── TICK: CHECK EVERY 10s FOR DUE REMINDERS ────────────

  useEffect(() => {
    if (!userId) return;
    loadReminders();

    tickRef.current = setInterval(() => {
      const now = Date.now();

      setReminders(prev => {
        for (const r of prev) {
          if (r.isDismissed) continue;
          const remindTime = new Date(r.remindAt).getTime();
          const minsUntil = (remindTime - now) / 60_000;

          // 5-minute early warning (toast only, not the full popup)
          if (
            !r.isFired &&
            !earlyWarned.current.has(r.id) &&
            minsUntil > 0 &&
            minsUntil <= EARLY_WARNING_MINUTES
          ) {
            earlyWarned.current.add(r.id);
            const mins = Math.ceil(minsUntil);
            const label = mins === 1 ? '1 minuto' : mins + ' minutos';
            toast(r.title + ' - en ' + label, {
              duration: EARLY_WARNING_TOAST_DURATION,
            });
            playNotificationSound('message');
          }

          // Exact time: full alert popup + browser notification
          if (!r.isFired && !firedIds.current.has(r.id) && remindTime <= now) {
            firedIds.current.add(r.id);
            playNotificationSound('message');
            setActiveAlert(r);

            // Mark fired in DB (fire-and-forget)
            (supabase
              .from('chat_reminders' as any)
              .update({ is_fired: true } as any) as any)
              .eq('id', r.id)
              .then(() => {});

            // Schedule next occurrence if repeating
            handleRepeat(r);

            // Browser notification (works even if tab is in background)
            fireBrowserNotification(r);

            break; // process one alert at a time
          }
        }
        return prev;
      });
    }, TICK_INTERVAL_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [userId, loadReminders, handleRepeat, fireBrowserNotification]);

  // ─── REALTIME: LISTEN FOR DB CHANGES ────────────────────

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('reminders:' + userId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_reminders',
          filter: 'user_id=eq.' + userId,
        },
        () => {
          loadReminders();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadReminders]);

  // ─── PUBLIC API ─────────────────────────────────────────

  return {
    reminders,
    loading,
    activeAlert,
    createReminder,
    dismissReminder,
    snoozeReminder,
    deleteReminder,
    loadReminders,
    setActiveAlert,
  };
}