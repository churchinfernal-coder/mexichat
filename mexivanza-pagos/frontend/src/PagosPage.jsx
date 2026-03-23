import React, { useState } from "react";
import ConnectMercadoPago from "./components/ConnectMercadoPago";
import SendMoney from "./components/SendMoney";
import TransactionHistory from "./components/TransactionHistory";

export default function PagosPage() {
  const [activeTab, setActiveTab] = useState("send");

  // TODO: Get from your auth context
  const currentUser = {
    userId: "luisa_123",
    email: "luisa@example.com",
  };

  // TODO: Load from your contacts/friends API
  const contacts = [
    { id: "maria_456", name: "María García", email: "maria@example.com" },
    { id: "carlos_789", name: "Carlos López", email: "carlos@example.com" },
  ];

  const tabs = [
    { key: "send",    label: "💵 Enviar",    icon: "send" },
    { key: "history", label: "📋 Historial", icon: "history" },
    { key: "account", label: "🔗 Cuenta",    icon: "account" },
  ];

  return (
    <div style={styles.page}>
      <h1 style={styles.header}>
        <span style={{ color: "#333" }}>Mexi</span>
        <span style={{ color: "#4A90D9" }}>Chat</span>
        <span style={styles.subtitle}> — Pagos</span>
      </h1>

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.activeTab : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.content}>
        {activeTab === "send" && (
          <SendMoney
            currentUser={currentUser}
            contacts={contacts}
            onSuccess={(data) => {
              console.log("Transfer initiated:", data);
            }}
          />
        )}
        {activeTab === "history" && (
          <TransactionHistory currentUserId={currentUser.userId} />
        )}
        {activeTab === "account" && <ConnectMercadoPago />}
      </div>
    </div>
  );
}

const styles = {
  page:     { maxWidth: 500, margin: "0 auto", padding: "20px 16px", fontFamily: "system-ui" },
  header:   { textAlign: "center", fontSize: 28, marginBottom: 20 },
  subtitle: { fontSize: 18, color: "#999" },
  tabs:     { display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 },
  tab:      {
    padding: "10px 18px", borderRadius: 10, border: "1px solid #ddd",
    backgroundColor: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500,
  },
  activeTab: { backgroundColor: "#4A90D9", color: "#fff", borderColor: "#4A90D9" },
  content:   { minHeight: 400 },
};
