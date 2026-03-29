import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/theme-platinum.css";
import "./styles/theme-diamond.css";
import "./styles/theme-gold.css";

window.onerror = (msg, src, line, col, err) => {
  const el = document.getElementById("root");
  if (el) el.innerHTML = '<div style="padding:24px;color:#f87171;background:#030712;min-height:100vh;font-family:monospace"><h2>CRASH</h2><pre>' + msg + '\n' + src + ':' + line + ':' + col + '\n' + (err && err.stack ? err.stack : '') + '</pre><button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;background:#10b981;color:white;border:none;border-radius:6px">Reload</button></div>';
};

window.onunhandledrejection = (e) => {
  const el = document.getElementById("root");
  if (el && el.innerHTML.indexOf("CRASH") === -1) {
    const reason = e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : "Unknown";
    el.innerHTML = '<div style="padding:24px;color:#f87171;background:#030712;min-height:100vh;font-family:monospace"><h2>PROMISE CRASH</h2><pre>' + reason + '</pre><button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;background:#10b981;color:white;border:none;border-radius:6px">Reload</button></div>';
  }
};

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err: any) {
  const el = document.getElementById("root");
  if (el) el.innerHTML = '<div style="padding:24px;color:#f87171;background:#030712;min-height:100vh;font-family:monospace"><h2>MOUNT CRASH</h2><pre>' + (err && err.stack ? err.stack : err) + '</pre></div>';
}