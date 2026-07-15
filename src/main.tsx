import { createRoot } from "react-dom/client";
import { initSecurity } from "@/services/securityGuard";
import { initObservability, reportCrash } from "@/services/observability";
import App from "./App";
import "./index.css";
import "./styles/theme-platinum.css";
import "./styles/theme-diamond.css";
import "./styles/theme-gold.css";
import "./styles/theme-obsidian.css";

// --- Guard against Google Translate DOM crashes (removeChild/insertBefore) ---
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== "undefined") {
        console.warn("Cannot remove a child from a different parent", child, this);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== "undefined") {
        console.warn("Cannot insert before a reference node from a different parent", referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
// --- End guard ---

// Initialize security layer before anything else
initSecurity().catch(() => {});
initObservability();

window.onerror = (msg, src, line, col, err) => {
  reportCrash('window.onerror', err ?? String(msg), {
    src: src ?? 'unknown',
    line: line ?? 0,
    col: col ?? 0,
  });
  const el = document.getElementById("root");
  if (el) el.innerHTML = '<div style="padding:24px;color:#f87171;background:#030712;min-height:100vh;font-family:monospace"><h2>CRASH</h2><pre>' + msg + '\n' + src + ':' + line + ':' + col + '\n' + (err && err.stack ? err.stack : '') + '</pre><button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#10b981;color:#fff;border:none;border-radius:8px">Recargar</button></div>';
};

window.onunhandledrejection = (e) => {
  reportCrash('window.onunhandledrejection', e.reason, {
    type: 'promise_rejection',
  });
  const el = document.getElementById("root");
  if (el && el.innerHTML.indexOf("CRASH") === -1) {
    const reason = e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : "Unknown";
    el.innerHTML = '<div style="padding:24px;color:#f87171;background:#030712;min-height:100vh;font-family:monospace"><h2>PROMISE CRASH</h2><pre>' + reason + '</pre><button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#10b981;color:#fff;border:none;border-radius:8px">Recargar</button></div>';
  }
};

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err: any) {
  reportCrash('react.mount', err, {
    type: 'mount_crash',
  });
  const el = document.getElementById("root");
  if (el) el.innerHTML = '<div style="padding:24px;color:#f87171;background:#030712;min-height:100vh;font-family:monospace"><h2>MOUNT CRASH</h2><pre>' + (err && err.stack ? err.stack : err) + '</pre><button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#10b981;color:#fff;border:none;border-radius:8px">Recargar</button></div>';
}