import re

# ═══ Fix 1: useGlobalCallManager.ts — full enterprise rewrite ═══
with open("src/hooks/useGlobalCallManager.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the handlePushRejectCall null safety (lines ~430-440)
content = content.replace(
    """    const handlePushRejectCall = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!detail?.fromUserId) return;

      console.log('[GlobalCallManager] ❌ Push reject call from:', detail.fromUserId);

      // If we have an incoming call from this caller, reject it
      if (incomingCallRef.current?.from === detail.fromUserId) {
        stopRingtone();
        clearCallTimeout();
        if (incomingCallRef.current.callId) {
          webRTCService.rejectCall(incomingCallRef.current.callId);
        }
        if (incomingCallRef.current.sessionId) {
          callSession.markDeclined(incomingCallRef.current.sessionId, userId);
        }
        clearIncomingCall();
      }
    };""",
    """    const handlePushRejectCall = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!detail?.fromUserId) return;

      console.log('[GlobalCallManager] ❌ Push reject call from:', detail.fromUserId);

      // Snapshot ref — null-safe access throughout
      const current = incomingCallRef.current;
      if (!current || current.from !== detail.fromUserId) return;

      stopRingtone();
      clearCallTimeout();
      if (current.callId) {
        webRTCService.rejectCall(current.callId);
      }
      if (current.sessionId && userId) {
        callSession.markDeclined(current.sessionId, userId);
      }
      clearIncomingCall();
    };"""
)

with open("src/hooks/useGlobalCallManager.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("OK fixed useGlobalCallManager.ts — null safety")


# ═══ Fix 2: tsconfig.json — silence baseUrl deprecation ═══
with open("tsconfig.json", "r", encoding="utf-8") as f:
    content = f.read()

# Add ignoreDeprecations right after "strict": true
content = content.replace(
    '"strict": true,',
    '"strict": true,\n    "ignoreDeprecations": "6.0",'
)

with open("tsconfig.json", "w", encoding="utf-8") as f:
    f.write(content)
print("OK fixed tsconfig.json — ignoreDeprecations added")
