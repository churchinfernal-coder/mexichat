/**
 * MEXICHAT — Enterprise Call Context v2
 * Single source of truth for ALL call state across the entire application.
 * Now includes DB session tracking via callSessionId.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface IncomingCallSignal {
  from: string;
  callerName: string;
  callType: 'audio' | 'video';
  conversationId: string;
  callId: string;              // WebRTC callId from webrtc-service
  sessionId: string | null;    // DB call_sessions.id
  avatarUrl?: string | null;
  receivedAt: number;
}

export interface ActiveCallState {
  active: boolean;
  type: 'audio' | 'video';
  status: 'calling' | 'ringing' | 'connected' | 'ended';
  duration: number;
  isMuted: boolean;
  isVideoOff: boolean;
  peerId: string;
  conversationId: string;
  callId: string;              // WebRTC callId
  sessionId: string | null;    // DB call_sessions.id
}

interface CallContextValue {
  // Incoming call (global)
  incomingCall: IncomingCallSignal | null;
  setIncomingCall: (call: IncomingCallSignal | null) => void;
  clearIncomingCall: () => void;

  // Active call (during WebRTC session)
  activeCall: ActiveCallState | null;
  setActiveCall: (call: ActiveCallState | null) => void;
  updateActiveCall: (update: Partial<ActiveCallState>) => void;

  // Pending offer for ChatWindow to consume on mount
  pendingOffer: RTCSessionDescriptionInit | null;
  consumePendingOffer: () => RTCSessionDescriptionInit | null;
  setPendingOffer: (offer: RTCSessionDescriptionInit | null) => void;

  // Guard to prevent duplicate processing
  isProcessingCall: React.MutableRefObject<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const CallContext = createContext<CallContextValue | null>(null);

export const useCallContext = (): CallContextValue => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallProvider');
  return ctx;
};

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [incomingCall, setIncomingCallState] = useState<IncomingCallSignal | null>(null);
  const [activeCall, setActiveCallState] = useState<ActiveCallState | null>(null);
  const [pendingOffer, setPendingOfferState] = useState<RTCSessionDescriptionInit | null>(null);
  const isProcessingCall = useRef(false);

  const setIncomingCall = useCallback((call: IncomingCallSignal | null) => {
    setIncomingCallState(call);
  }, []);

  const clearIncomingCall = useCallback(() => {
    setIncomingCallState(null);
    isProcessingCall.current = false;
  }, []);

  const setActiveCall = useCallback((call: ActiveCallState | null) => {
    setActiveCallState(call);
    if (call) {
      setIncomingCallState(null);
    }
  }, []);

  const updateActiveCall = useCallback((update: Partial<ActiveCallState>) => {
    setActiveCallState(prev => prev ? { ...prev, ...update } : null);
  }, []);

  const setPendingOffer = useCallback((offer: RTCSessionDescriptionInit | null) => {
    setPendingOfferState(offer);
  }, []);

  const consumePendingOffer = useCallback((): RTCSessionDescriptionInit | null => {
    const offer = pendingOffer;
    setPendingOfferState(null);
    return offer;
  }, [pendingOffer]);

  const value: CallContextValue = {
    incomingCall,
    setIncomingCall,
    clearIncomingCall,
    activeCall,
    setActiveCall,
    updateActiveCall,
    pendingOffer,
    consumePendingOffer,
    setPendingOffer,
    isProcessingCall,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export default CallContext;