import React, { useState } from "react";
import { sendMoney } from "../services/api";

export default function SendMoney({ currentUser, contacts, onSuccess }) {
  const [receiverId, setReceiverId]       = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [amount, setAmount]               = useState("");
  const [description, setDescription]     = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data } = await sendMoney({
        receiverId,
        receiverEmail,
        amount: parseFloat(amount),
        description,
      });

      if (data.checkoutUrl) {
        // Redirect to Mercado Pago checkout
        // In production use data.checkoutUrl
        // For testing use data.sandboxUrl
        window.location.href =
          process.env.NODE_ENV === "production"
            ? data.checkoutUrl
            : data.sandboxUrl;
      }

      if (onSuccess) onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.error || "Error al procesar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="send-money-container" style={styles.container}>
      <h2 style={styles.title}>💵 Enviar Dinero</h2>

      <form onSubmit={handleSend} style={styles.form}>
        {/* Recipient selector */}
        <div style={styles.field}>
          <label style={styles.label}>Enviar a:</label>
          <select
            value={receiverId}
            onChange={(e) => {
              const contact = contacts?.find((c) => c.id === e.target.value);
              setReceiverId(e.target.value);
              setReceiverEmail(contact?.email || "");
            }}
            style={styles.input}
            required
          >
            <option value="">Selecciona un contacto</option>
            {contacts?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div style={styles.field}>
          <label style={styles.label}>Monto (MXN):</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$0.00"
            style={styles.input}
            required
          />
        </div>

        {/* Description */}
        <div style={styles.field}>
          <label style={styles.label}>Concepto (opcional):</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Pago de comida"
            style={styles.input}
            maxLength={140}
          />
        </div>

        {/* Error */}
        {error && <div style={styles.error}>⚠️ {error}</div>}

        {/* Submit */}
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Procesando..." : `Enviar $${amount || "0"} MXN`}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: { maxWidth: 400, margin: "0 auto", padding: 20, fontFamily: "system-ui" },
  title:     { textAlign: "center", marginBottom: 20 },
  form:      { display: "flex", flexDirection: "column", gap: 16 },
  field:     { display: "flex", flexDirection: "column", gap: 4 },
  label:     { fontWeight: 600, fontSize: 14, color: "#333" },
  input:     { padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 16 },
  button:    {
    padding: "14px 20px", borderRadius: 10, border: "none",
    backgroundColor: "#4A90D9", color: "white", fontSize: 16,
    fontWeight: 600, cursor: "pointer", marginTop: 8,
  },
  error:     { color: "#d32f2f", backgroundColor: "#ffeaea", padding: 10, borderRadius: 8, fontSize: 14 },
};
