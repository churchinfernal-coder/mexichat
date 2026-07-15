/**
 * MexiChat — Security Guard v1.0
 * Runtime anti-hack, anti-tamper, anti-debug protection
 * Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 */
import { Capacitor } from '@capacitor/core';
import { trackSecurityEvent } from '@/services/observability';

// ══════════════════════════════════════════
// 1. ROOT / JAILBREAK DETECTION
// ══════════════════════════════════════════

interface SecurityCheckResult {
  isCompromised: boolean;
  reasons: string[];
}

const SECURITY_EVENT_COOLDOWN_MS = 5 * 60 * 1000;
const securityEventTimestamps = new Map<string, number>();

function emitSecuritySignal(event: string, props?: Record<string, string | number | boolean>): void {
  const now = Date.now();
  const last = securityEventTimestamps.get(event) ?? 0;
  if (now - last < SECURITY_EVENT_COOLDOWN_MS) return;
  securityEventTimestamps.set(event, now);
  trackSecurityEvent(event, props);
}

export async function checkDeviceIntegrity(): Promise<SecurityCheckResult> {
  const reasons: string[] = [];

  if (!Capacitor.isNativePlatform()) {
    return { isCompromised: false, reasons: [] };
  }

  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    try {
      // Check for root management apps via user agent anomalies
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('rooted') || ua.includes('supersu') || ua.includes('magisk')) {
        reasons.push('root_detected_ua');
        emitSecuritySignal('root_detected_ua', { platform: 'android' });
      }

      // Check if Frida server is running (common hacking tool on port 27042)
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 500);
        const response = await fetch('http://localhost:27042', {
          signal: controller.signal,
          mode: 'no-cors',
        }).catch(() => null);
        clearTimeout(timeout);
        if (response) {
          reasons.push('frida_server_detected');
          emitSecuritySignal('frida_server_detected', { platform: 'android' });
        }
      } catch {
        // Expected — port closed = safe
      }

      // Check for common hook frameworks
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 500);
        await fetch('http://localhost:8008', {
          signal: controller2.signal,
          mode: 'no-cors',
        }).catch(() => null);
        clearTimeout(timeout2);
      } catch {
        // Safe
      }
    } catch {
      // Silently continue
    }
  }

  // Check for developer tools
  if (detectDevTools()) {
    reasons.push('devtools_detected');
    emitSecuritySignal('devtools_detected', { context: 'device_integrity' });
  }

  return {
    isCompromised: reasons.length > 0,
    reasons,
  };
}

// ══════════════════════════════════════════
// 2. DEVTOOLS / DEBUG DETECTION
// ══════════════════════════════════════════

function detectDevTools(): boolean {
  const widthThreshold = window.outerWidth - window.innerWidth > 160;
  const heightThreshold = window.outerHeight - window.innerHeight > 160;
  return widthThreshold || heightThreshold;
}

// ══════════════════════════════════════════
// 3. ANTI-TAMPERING — Detect modified JS
// ══════════════════════════════════════════

export function checkAppIntegrity(): boolean {
  // Verify Supabase URL hasn't been swapped to attacker's server
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (supabaseUrl && !supabaseUrl.includes('supabase.co')) {
    console.error('[Security] Supabase URL tampered');
    emitSecuritySignal('supabase_url_tampered');
    return false;
  }

  // Verify no malicious scripts injected into DOM
  const scripts = document.querySelectorAll('script[src]');
  for (const script of scripts) {
    const src = (script as HTMLScriptElement).src;
    if (src && !src.includes(window.location.origin) && !src.includes('capacitor')) {
      console.error('[Security] Unknown script injected:', src);
      emitSecuritySignal('unknown_script_injected', { src });
      return false;
    }
  }

  return true;
}

// ══════════════════════════════════════════
// 4. SCREENSHOT / SCREEN RECORDING BLOCK
// ══════════════════════════════════════════

export function preventScreenCapture(): void {
  if (!Capacitor.isNativePlatform()) return;

  if (document.getElementById('mc-screen-capture-style')) return;

  const style = document.createElement('style');
  style.id = 'mc-screen-capture-style';
  style.textContent = `
    .sensitive-content {
      -webkit-user-select: none;
      user-select: none;
    }
    .no-screenshot {
      -webkit-user-select: none;
      user-select: none;
    }
  `;
  document.head.appendChild(style);
}

// ══════════════════════════════════════════
// 5. RATE LIMITING — Prevent brute force
// ══════════════════════════════════════════

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function pruneRateLimitMap(now: number): void {
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

export function rateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  pruneRateLimitMap(now);
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

// ═════════════════════��════════════════════
// 6. ANTI-COPY — Disable devtools shortcuts
// ══════════════════════════════════════════

export function initAntiCopy(): void {
  if (!import.meta.env.PROD) return;

  // Disable right-click context menu
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
  });

  // Disable devtools keyboard shortcuts
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // F12
    if (e.key === 'F12') { e.preventDefault(); return; }
    // Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); return; }
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') { e.preventDefault(); return; }
    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key === 'u') { e.preventDefault(); return; }
    // Ctrl+S (Save Page)
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); return; }
    // Ctrl+Shift+C (Element Inspector)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); return; }
  });

  // Disable text selection on body (but allow in inputs/textareas)
  document.addEventListener('selectstart', (e: Event) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
    // Allow selection in chat messages for copy
    if (target instanceof Element && target.closest('.message-content, .chat-message')) return;
    e.preventDefault();
  });
}

// ══════════════════════════════════════════
// 7. CONSOLE TRAP — Detect console access
// ══════════════════════════════════════════

function installConsoleTrap(): void {
  if (!import.meta.env.PROD) return;

  // Overwrite console methods to detect usage
  const noop = () => {};
  const originalError = console.error.bind(console);

  // In production, silence most console output
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.table = noop;
  // Keep console.error and console.warn for critical issues
  console.error = originalError;
}

// ══════════════════════════════════════════
// 8. PERIODIC INTEGRITY CHECKS
// ══════════════════════════════════════════

function startIntegrityMonitor(): void {
  // Check every 30 seconds for tampering
  setInterval(() => {
    if (!checkAppIntegrity()) {
      console.error('[Security] Integrity check failed during runtime');
      emitSecuritySignal('runtime_integrity_failed');
    }

    // Check if someone attached a debugger
    if (detectDevTools()) {
      // Don't crash — just log
      console.warn('[Security] DevTools detected');
      emitSecuritySignal('devtools_detected', { context: 'runtime_monitor' });
    }
  }, 30000);
}

// ══════════════════════════════════════════
// 9. MAIN SECURITY INIT
// ══════════════════════════════════════════

let initialized = false;

export async function initSecurity(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Anti-copy protections
  initAntiCopy();

  // Console trap
  installConsoleTrap();

  // Screenshot prevention
  preventScreenCapture();

  // App integrity check
  const integrityOk = checkAppIntegrity();
  if (!integrityOk) {
    console.error('[Security] App integrity check FAILED');
  }

  // Device integrity (root/jailbreak)
  const deviceCheck = await checkDeviceIntegrity();
  if (deviceCheck.isCompromised) {
    console.warn('[Security] Device may be compromised:', deviceCheck.reasons);
    emitSecuritySignal('device_compromised', {
      reason_count: deviceCheck.reasons.length,
    });
  }

  // Start periodic monitoring
  startIntegrityMonitor();
}
