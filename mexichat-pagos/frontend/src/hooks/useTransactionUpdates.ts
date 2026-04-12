// ╔══════════════════════════════════════════════════════════════╗
// ║  Realtime Transaction Updates via Supabase Realtime          ║
// ║  Live status changes pushed to frontend                     ║
// ╚══════════════════════════════════════════════════════════════╝

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/pagos-client";
import type { Transaction, TxStatus } from "../types/pagos";

interface TransactionUpdate {
  transaction: Transaction;
  oldStatus: TxStatus;
  newStatus: TxStatus;
  timestamp: string;
}

export function useTransactionUpdates(userId: string | null) {
  const [latestUpdate, setLatestUpdate] = useState<TransactionUpdate | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const clearUpdate = useCallback(() => setLatestUpdate(null), []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`tx-updates-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          const newRow = payload.new as Transaction;
          const oldRow = payload.old as Partial<Transaction>;

          // Only fire if this user is involved
          if (newRow.sender_id !== userId && newRow.receiver_id !== userId) return;

          // Only fire if status actually changed
          if (oldRow.status && oldRow.status === newRow.status) return;

          setLatestUpdate({
            transaction: newRow,
            oldStatus: (oldRow.status || "pending") as TxStatus,
            newStatus: newRow.status,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [userId]);

  return { latestUpdate, clearUpdate, isSubscribed };
}
