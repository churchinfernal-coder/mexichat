import React, { useState, useEffect } from "react";
import { getOAuthStatus, getConnectUrl, disconnectMP } from "../services/api";

export default function ConnectMercadoPago() {
  const [connected, setConnected]   = useState(false);
  const [mpEmail, setMpEmail]       = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { data } = await getOAuthStatus();
      setConnected(data.connected);
      setMpEmail(data.mpEmail);
    } catch (err) {
      console.error("Error checking MP status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { data } = await getConnectUrl();
      window.location.href = data.authUrl;
    } catch (err) {
      alert("Error al conectar con Mercado Pago");
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm("¿Desvincular tu cuenta de Mercado Pago?")) {
      await disconnectMP();
      setConnected(false);
      setMpEmail(null);
    }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 20 }}>Cargando...</div>;

  return (
    <div style={styles.container}>
      {connected ? (
        <div style={styles.connected}>
          <div style={styles.statusBadge}>✅ Conectado</div>
          <p style={styles.email}>{mpEmail || "Cuenta vinculada"}</p>
          <button onClick={handleDisconnect} style={styles.disconnectBtn}>
            Desvincular cuenta
          </button>
        </div>
      ) : (
        <div style={styles.disconnected}>
          <img
            src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.6.92/mercadopago/logo__large@2x.png"
            alt="Mercado Pago"
            style={{ width: 200, marginBottom: 16 }}
          />
          <p style={styles.text}>Vincula tu cuenta para enviar y recibir pagos</p>
          <button onClick={handleConnect} style={styles.connectBtn}>
            Conectar Mercado Pago
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container:      { maxWidth: 400, margin: "0 auto", padding: 20, textAlign: "center" },
  connected:      { backgroundColor: "#e8f5e9", padding: 24, borderRadius: 12 },
  disconnected:   { backgroundColor: "#f5f5f5", padding: 24, borderRadius: 12 },
  statusBadge:    { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  email:          { color: "#666", fontSize: 14 },
  text:           { color: "#555", marginBottom: 16 },
  connectBtn:     {
    padding: "14px 28px", borderRadius: 10, border: "none",
    backgroundColor: "#009ee3", color: "white", fontSize: 16,
    fontWeight: 600, cursor: "pointer",
  },
  disconnectBtn:  {
    padding: "10px 20px", borderRadius: 8, border: "1px solid #d32f2f",
    backgroundColor: "transparent", color: "#d32f2f", fontSize: 14,
    cursor: "pointer", marginTop: 12,
  },
};
