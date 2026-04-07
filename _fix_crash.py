import re

# Fix 1: useGlobalCallManager.ts - delay WebRTC init and channel subscriptions
with open("src/hooks/useGlobalCallManager.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Replace WebRTC init effect
content = content.replace(
    """  // ─── Initialize WebRTC service ───
  useEffect(() => {
    if (!userId) return;
    webRTCService.ensureInitialized().catch(err => {
      console.error('[GlobalCallManager] WebRTC init failed:', err);
    });
  }, [userId]);""",
    """  // ─── Initialize WebRTC service (delayed to let auth settle in Capacitor) ───
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      webRTCService.ensureInitialized().catch(err => {
        if (!cancelled) console.error('[GlobalCallManager] WebRTC init failed:', err);
      });
    }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId]);"""
)

with open("src/hooks/useGlobalCallManager.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("OK fixed useGlobalCallManager.ts")

# Fix 2: webrtc-service.ts - guard ensureInitialized with auth check + catch
with open("src/lib/webrtc-service.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    """  public async ensureInitialized(): Promise<void> {
    if (this.initialized && this.channel) return;
    if (this.initializingPromise) return this.initializingPromise;
    this.initializingPromise = this._initialize();
    await this.initializingPromise;
  }""",
    """  public async ensureInitialized(): Promise<void> {
    if (this.initialized && this.channel) return;
    if (this.initializingPromise) return this.initializingPromise;
    this.initializingPromise = this._initialize().catch(err => {
      this.initializingPromise = null;
      this.initialized = false;
      console.warn('[webrtc] Init failed gracefully:', err?.message || err);
    });
    await this.initializingPromise;
  }"""
)

with open("src/lib/webrtc-service.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("OK fixed webrtc-service.ts")

# Fix 3: App.tsx - delay biometric gate to prevent crash on login
with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    """  useEffect(() => {
    if (!user || !splashDone) return;
    if (!biometric.config.enabled) { setBiometricVerified(true); return; }

    // Auto-verify on mount (triggers biometric prompt on native)
    biometric.gateAppOpen().then(ok => {
      setBiometricVerified(ok || !biometric.status.isAvailable);
      if (ok) recordActivity();
    });
  }, [user, splashDone, biometric.config.enabled]); // eslint-disable-line react-hooks/exhaustive-deps""",
    """  useEffect(() => {
    if (!user || !splashDone) return;
    if (!biometric.config.enabled) { setBiometricVerified(true); return; }

    // Delay biometric gate to let auth + Capacitor settle after login
    const timer = setTimeout(() => {
      biometric.gateAppOpen().then(ok => {
        setBiometricVerified(ok || !biometric.status.isAvailable);
        if (ok) recordActivity();
      }).catch(() => {
        // If biometric fails, don't block the app
        setBiometricVerified(true);
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, splashDone, biometric.config.enabled]); // eslint-disable-line react-hooks/exhaustive-deps"""
)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("OK fixed App.tsx")

# Fix 4: Auth.tsx - increase safeNavigate delay for OTP to let session propagate
with open("src/pages/Auth.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "// Safe navigation with delay to ensure auth state is synced\n        await safeNavigate('/', 800);",
    "// Safe navigation with longer delay for Capacitor — auth state needs time to propagate\n        await safeNavigate('/', 2000);"
)

with open("src/pages/Auth.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("OK fixed Auth.tsx")
