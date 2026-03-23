import React, { useState, useEffect } from "react";
import { getTransactionHistory } from "../services/api";

export default function TransactionHistory({ currentUserId }) {
  const [transactions, setTransactions] = useState([]);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    loadHistory();
  }, [page]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await getTransactionHistory(page);
      setTransactions(data.transactions);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoading(false);
    }
  };

  const statusEmoji = {
    approved:   "✅",
    pending:    "⏳",
    in_process: "🔄",
    rejected:   "❌",
    cancelled:  "🚫",
    refunded:   "↩️",
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) return <div style={{ textAlign: "center", padding: 20 }}>Cargando historial...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📋 Historial de Pagos</h2>

      {transactions.length === 0 ? (
        <p style={styles.empty}>No tienes transacciones aún</p>
      ) : (
        <div style={styles.list}>
          {transactions.map((tx) => {
            const isSender = tx.senderId === currentUserId;
            return (
              <div key={tx._id} style={styles.item}>
                <div style={styles.row}>
                  <span style={styles.direction}>
                    {isSender ? "📤 Enviaste" : "📥 Recibiste"}
                  </span>
                  <span style={{
                    ...styles.amount,
                    color: isSender ? "#d32f2f" : "#2e7d32",
                  }}>
                    {isSender ? "-" : "+"}${tx.amount.toLocaleString("es-MX")} MXN
                  </span>
                </div>
                <div style={styles.meta}>
                  <span>{statusEmoji[tx.status] || "❓"} {tx.status}</span>
                  <span>{formatDate(tx.createdAt)}</span>
                </div>
                {tx.description && <p style={styles.desc}>{tx.description}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={styles.pageBtn}>
            ← Anterior
          </button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={styles.pageBtn}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container:  { maxWidth: 500, margin: "0 auto", padding: 20, fontFamily: "system-ui" },
  title:      { textAlign: "center", marginBottom: 20 },
  empty:      { textAlign: "center", color: "#999", padding: 40 },
  list:       { display: "flex", flexDirection: "column", gap: 12 },
  item:       { padding: 16, backgroundColor: "#f9f9f9", borderRadius: 12, border: "1px solid #eee" },
  row:        { display: "flex", justifyContent: "space-between", alignItems: "center" },
  direction:  { fontWeight: 600, fontSize: 15 },
  amount:     { fontWeight: 700, fontSize: 18 },
  meta:       { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#777", marginTop: 6 },
  desc:       { fontSize: 13, color: "#555", marginTop: 4, fontStyle: "italic" },
  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  pageBtn:    { padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", backgroundColor: "#fff" },
};
