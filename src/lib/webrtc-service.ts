import { supabase } from "@/integrations/supabase/client";

interface LocalCallSignal {
  type: "offer" | "answer" | "ice-candidate" | "call-request" | "call-accept" | "call-reject" | "call-end";
  from: string;
  to: string;
  callId?: string;
  data?: any;
  timestamp: number;
}

type CallType = "audio" | "video";

class WebRTCService {
  private pcs = new Map<string, RTCPeerConnection>();
  private localStreams = new Map<string, MediaStream>();
  private remoteStreams = new Map<string, MediaStream>();
  private candidateBuffer = new Map<string, RTCIceCandidateInit[]>();
    private channel: ReturnType<typeof supabase.channel> | null = null;
  private globalChannel: ReturnType<typeof supabase.channel> | null = null;
  private currentUserId: string | null = null;
  private initialized = false;
  private initializingPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private callIdToOtherUser = new Map<string, string>();
  private callTypes = new Map<string, CallType>();
  private localStream: MediaStream | null = null;
  private pendingOffers = new Map<string, RTCSessionDescriptionInit>();

  // Connection timeouts — auto-end call if peer never connects
  private connectionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly CONNECTION_TIMEOUT_MS = 45_000; // 45 seconds

  // ICE restart tracking
  private iceRestartAttempts = new Map<string, number>();
  private readonly MAX_ICE_RESTARTS = 3;

  public onRemoteStream: ((stream: MediaStream, callId?: string) => void) | null = null;
  public onCallRequest: ((from: string, callId: string, callType: CallType) => void) | null = null;
  public onCallAccept: ((callId: string) => void) | null = null;
  public onCallReject: ((callId: string) => void) | null = null;
  public onCallEnd: ((callId: string) => void) | null = null;
  public onError: ((err: any) => void) | null = null;
  public onCallStateChange: ((state: string, callId?: string) => void) | null = null;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      // Free TURN servers for NAT traversal on mobile carriers
      // Replace with your own TURN server in production for reliability
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ],
    iceCandidatePoolSize: 10
  };

  constructor() {
    console.log('[webrtc] 🚀 WebRTC Service instantiated');
  }

  // ----------
  // INITIALIZATION
  // ----------

  public async ensureInitialized(): Promise<void> {
    if (this.initialized && this.channel) return;
    if (this.initializingPromise) return this.initializingPromise;
    this.initializingPromise = this._initialize().catch(err => {
      this.initializingPromise = null;
      this.initialized = false;
      console.warn('[webrtc] Init failed gracefully:', err?.message || err);
    });
    await this.initializingPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) throw new Error("Not authenticated");
      this.currentUserId = user.id;

      // Clean up previous channel
      if (this.channel) {
        try { await this.channel.unsubscribe(); } catch {}
        this.channel = null;
      }

      const channelName = `webrtc:${this.currentUserId}`;
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false, ack: true },
          presence: { key: this.currentUserId }
        }
      });

      this.channel
        .on("broadcast", { event: "webrtc-signal" }, (payload: any) => {
          try {
            const signal: LocalCallSignal = payload.payload;
            if (!signal || !signal.type || signal.to !== this.currentUserId) return;
            console.log(`[webrtc] 📥 Received: ${signal.type} from: ${signal.from?.slice(0, 8)}`);
            this._handleIncomingSignal(signal).catch(err => {
              console.error("[webrtc] handleIncomingSignal error", err);
            });
          } catch (err) {
            console.error("[webrtc] invalid payload", err);
          }
        })
        .subscribe((status: string) => {
          console.log(`[webrtc] Channel status: ${status}`);
          if (status === "SUBSCRIBED") {
            this.initialized = true;
            this.initializingPromise = null;
            this.reconnectAttempts = 0;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.initialized = false;
            this.initializingPromise = null;
            this._attemptReconnect();
          }
        });

      // Also subscribe to the global channel so others can reach us
          // Also subscribe to the global channel so others can reach us
      this.globalChannel = supabase.channel('webrtc:global', {
        config: { broadcast: { self: false } }
      });
         this.globalChannel
        .on("broadcast", { event: "webrtc-signal" }, (payload: any) => {

          try {
            const signal: LocalCallSignal = payload.payload;
            if (!signal || !signal.type || signal.to !== this.currentUserId) return;
            console.log(`[webrtc] 📥 (global) Received: ${signal.type}`);
            this._handleIncomingSignal(signal).catch(() => {});
          } catch {}
        })
        .subscribe();

      console.log(`[webrtc] ✅ Initialized for user: ${this.currentUserId.slice(0, 8)}`);
    } catch (err) {
      this.initialized = false;
      this.initializingPromise = null;
      console.error("[webrtc] initialize failed", err);
      throw err;
    }
  }

  private _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[webrtc] ❌ Max reconnect attempts reached`);
      this.onError?.("Connection lost. Please refresh.");
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
    console.warn(`[webrtc] 🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    setTimeout(() => {
      this.ensureInitialized().catch(() => {});
    }, delay);
  }

  // ----------
  // SIGNALING
  // ----------

  private async sendSignal(signal: LocalCallSignal, retries = 3): Promise<void> {
    await this.ensureInitialized();
    if (!this.channel) return;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[webrtc] 📤 Sending: ${signal.type} to: ${signal.to?.slice(0, 8)}`);

        // Send on both user-specific and global channels for reliability
        await this.channel.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: signal
        });

        // Also send on global as fallback
        try {
          if (this.globalChannel) {
            await this.globalChannel.send({

            type: "broadcast",
            event: "webrtc-signal",
            payload: signal
            });
          }
        } catch {}


        return; // Success
      } catch (err) {
        console.warn(`[webrtc] ⚠️ sendSignal attempt ${attempt + 1} failed`, err);
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    console.error("[webrtc] ❌ sendSignal failed after all retries");
  }

  // ----------
  // PEER CONNECTION
  // ----------

  private _createPC(callId: string, remoteUserId: string): RTCPeerConnection {
    // Close existing PC if any
    if (this.pcs.has(callId)) {
      const existing = this.pcs.get(callId)!;
      console.log(`[webrtc] 🔄 Closing existing PC for: ${callId.slice(0, 16)}`);
      try { existing.close(); } catch {}
      this.pcs.delete(callId);
    }

    this.callIdToOtherUser.set(callId, remoteUserId);
    console.log(`[webrtc] 🔧 Creating PC for: ${callId.slice(0, 16)}`);

    const pc = new RTCPeerConnection(this.rtcConfig);
    const remoteStream = new MediaStream();
    this.remoteStreams.set(callId, remoteStream);

    // ═══ ontrack — receive remote media ═══
    pc.ontrack = (evt) => {
      console.log(`[webrtc] 📺 ontrack: ${evt.track.kind} readyState: ${evt.track.readyState}`);

      // Add track to remote stream
      if (evt.track && !remoteStream.getTracks().find(t => t.id === evt.track.id)) {
        remoteStream.addTrack(evt.track);
      }

      // Also add from streams (more reliable on some browsers)
      evt.streams?.forEach(s => {
        s.getTracks().forEach(t => {
          if (!remoteStream.getTracks().find(existing => existing.id === t.id)) {
            remoteStream.addTrack(t);
          }
        });
      });

      // Ensure track stays enabled
      evt.track.onunmute = () => {
        console.log(`[webrtc] 📺 Track unmuted: ${evt.track.kind}`);
        this.onRemoteStream?.(remoteStream, callId);
      };

      evt.track.onended = () => {
        console.log(`[webrtc] 📺 Track ended: ${evt.track.kind}`);
      };

      this.onRemoteStream?.(remoteStream, callId);
    };

    // ═══ ICE candidates ═══
    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.sendSignal({
          type: "ice-candidate",
          from: this.currentUserId!,
          to: remoteUserId,
          callId,
          data: evt.candidate.toJSON(),
          timestamp: Date.now()
        }).catch(() => {});
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[webrtc] 🧊 ICE gathering: ${pc.iceGatheringState}`);
    };

    // ═══ Connection state — with ICE restart and timeout ═══
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[webrtc] 🔌 Connection: ${state}`);
      this.onCallStateChange?.(state, callId);

      if (state === 'connected') {
        // Clear connection timeout
        this._clearConnectionTimeout(callId);
        this.iceRestartAttempts.delete(callId);
        console.log(`[webrtc] ✅ CALL CONNECTED`);
      } else if (state === 'failed') {
        this._attemptICERestart(callId);
      } else if (state === 'disconnected') {
        // Give it 5 seconds to recover before restarting ICE
        setTimeout(() => {
          const currentPc = this.pcs.get(callId);
          if (currentPc && currentPc.connectionState === 'disconnected') {
            this._attemptICERestart(callId);
          }
        }, 5000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[webrtc] 🧊 ICE connection: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        this._attemptICERestart(callId);
      }
    };

    this.pcs.set(callId, pc);

    // Start connection timeout
    this._startConnectionTimeout(callId);

    return pc;
  }

  // ----------
  // ICE RESTART — carrier-grade retry
  // ----------

  private async _attemptICERestart(callId: string) {
    const attempts = this.iceRestartAttempts.get(callId) || 0;
    if (attempts >= this.MAX_ICE_RESTARTS) {
      console.error(`[webrtc] ❌ Max ICE restarts reached for: ${callId.slice(0, 16)}`);
      this.onCallStateChange?.('failed', callId);
      this.onError?.("Call connection failed. Please try again.");
      return;
    }

    this.iceRestartAttempts.set(callId, attempts + 1);
    console.warn(`[webrtc] 🔄 ICE restart ${attempts + 1}/${this.MAX_ICE_RESTARTS}`);

    const pc = this.pcs.get(callId);
    const remoteUserId = this.callIdToOtherUser.get(callId);
    if (!pc || !remoteUserId || !this.currentUserId) return;

    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);

      await this.sendSignal({
        type: "offer",
        from: this.currentUserId,
        to: remoteUserId,
        callId,
        data: offer,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("[webrtc] ICE restart failed", err);
    }
  }

  // ----------
  // CONNECTION TIMEOUT
  // ----------

  private _startConnectionTimeout(callId: string) {
    this._clearConnectionTimeout(callId);
    const timeout = setTimeout(() => {
      const pc = this.pcs.get(callId);
      if (pc && pc.connectionState !== 'connected') {
        console.warn(`[webrtc] ⏰ Connection timeout for: ${callId.slice(0, 16)}`);
        this.onCallStateChange?.('timeout', callId);
        this.endCall(callId).catch(() => {});
      }
    }, this.CONNECTION_TIMEOUT_MS);
    this.connectionTimeouts.set(callId, timeout);
  }

  private _clearConnectionTimeout(callId: string) {
    const timeout = this.connectionTimeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(callId);
    }
  }

  // ----------
  // ADD LOCAL TRACKS
  // ----------

  private _addLocalTracksToPC(callId: string) {
    const pc = this.pcs.get(callId);
    const local = this.localStreams.get(callId);
    if (!pc || !local) {
      console.warn(`[webrtc] Cannot add tracks — PC: ${!!pc}, Stream: ${!!local}`);
      return;
    }

    // Check if tracks already added
    const senders = pc.getSenders();
    if (senders.length > 0) {
      console.log(`[webrtc] Tracks already added (${senders.length} senders)`);
      return;
    }

    console.log(`[webrtc] 🎥 Adding ${local.getTracks().length} local tracks to PC`);
    local.getTracks().forEach(track => {
      try {
        pc.addTrack(track, local);
        console.log(`[webrtc] ✅ Added ${track.kind} track (enabled: ${track.enabled})`);
      } catch (err) {
        console.warn(`[webrtc] ⚠️ Failed to add ${track.kind}`, err);
      }
    });
  }

  // ----------
  // GET OTHER USER FROM CALL ID
  // ----------

  private _getOtherUserFromCallId(callId: string): string | null {
    const stored = this.callIdToOtherUser.get(callId);
    if (stored) return stored;

    if (!callId || !this.currentUserId) return null;

    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (5 parts, 36 chars)
    // callId format: uuid1-uuid2-timestamp
    // Split carefully
    const parts = callId.split('-');
    if (parts.length < 11) return null;

    const uuid1 = parts.slice(0, 5).join('-');
    const uuid2 = parts.slice(5, 10).join('-');

    if (uuid1 === this.currentUserId) {
      this.callIdToOtherUser.set(callId, uuid2);
      return uuid2;
    } else if (uuid2 === this.currentUserId) {
      this.callIdToOtherUser.set(callId, uuid1);
      return uuid1;
    }

    return null;
  }

  // ----------
  // HANDLE INCOMING SIGNALS
  // ----------

  private async _handleIncomingSignal(signal: LocalCallSignal) {
    if (!this.currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUserId = user?.id ?? null;
      if (!this.currentUserId) return;
    }

    if (signal.to !== this.currentUserId) return;

    switch (signal.type) {
      case "call-request":
        console.log(`[webrtc] 📞 Incoming call from ${signal.from?.slice(0, 8)}`);
        if (this.onCallRequest && signal.callId) {
          const callType = signal.data?.callType || "video";
          this.callIdToOtherUser.set(signal.callId, signal.from);
          this.callTypes.set(signal.callId, callType);
          this.onCallRequest(signal.from, signal.callId, callType);
        }
        break;

      case "call-accept":
        if (!signal.callId) break;
        console.log(`[webrtc] ✅ Call accepted by remote`);
        this.callIdToOtherUser.set(signal.callId, signal.from);
        this._createPC(signal.callId, signal.from);
        this._addLocalTracksToPC(signal.callId);
        await this._createAndSendOffer(signal.callId, signal.from);
        this.onCallAccept?.(signal.callId);
        break;

      case "call-reject":
        if (signal.callId) {
          console.log(`[webrtc] ❌ Call rejected`);
          this.onCallReject?.(signal.callId);
          this._cleanupCall(signal.callId);
        }
        break;

      case "call-end":
        if (signal.callId) {
          console.log(`[webrtc] 📞 Call ended by remote`);
          this.onCallEnd?.(signal.callId);
          this._cleanupCall(signal.callId);
        }
        break;

      case "offer":
        if (!signal.callId) break;
        console.log(`[webrtc] 📥 Received offer`);
        this.callIdToOtherUser.set(signal.callId, signal.from);
        this.pendingOffers.set(signal.callId, signal.data as RTCSessionDescriptionInit);

        // If we already have a PC (acceptCall was called first), handle now
        const existingPc = this.pcs.get(signal.callId);
        if (existingPc) {
          await this._handleOffer(signal.callId, signal.data, signal.from);
        }
        break;

      case "answer":
        if (!signal.callId) break;
        console.log(`[webrtc] 📥 Received answer`);
        await this._handleAnswer(signal.callId, signal.data);
        break;

      case "ice-candidate":
        if (!signal.callId) break;
        await this._handleIceCandidate(signal.callId, signal.data);
        break;
    }
  }

  // ----------
  // OFFER / ANSWER / ICE HANDLING
  // ----------

  private async _handleOffer(callId: string, offer: RTCSessionDescriptionInit, from: string) {
    let pc = this.pcs.get(callId);
    if (!pc) {
      pc = this._createPC(callId, from);
    }

    // Must be in stable state to accept offer
    if (pc.signalingState !== 'stable') {
      console.warn(`[webrtc] ⚠️ Cannot handle offer in state: ${pc.signalingState}, queuing`);
      // Wait for state to become stable
      await new Promise<void>((resolve) => {
        const check = () => {
          if (pc!.signalingState === 'stable') {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        setTimeout(check, 100);
        // Timeout after 5 seconds
        setTimeout(resolve, 5000);
      });
    }

    try {
      // CRITICAL: Add local tracks BEFORE setting remote description
      // This ensures tracks are part of the SDP negotiation
      this._addLocalTracksToPC(callId);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[webrtc] ✅ Set remote description (offer)`);

      // Add buffered ICE candidates
      await this._addBufferedCandidates(callId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log(`[webrtc] ✅ Created and set answer`);

      await this.sendSignal({
        type: "answer",
        from: this.currentUserId!,
        to: from,
        callId,
        data: answer,
        timestamp: Date.now()
      });

      this.pendingOffers.delete(callId);
    } catch (err) {
      console.error("[webrtc] ❌ Failed to handle offer", err);
      this.onError?.(err);
    }
  }

  private async _handleAnswer(callId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.pcs.get(callId);
    if (!pc) {
      console.warn("[webrtc] ⚠️ Answer received but no PC");
      return;
    }

    if (pc.signalingState !== 'have-local-offer') {
      console.warn(`[webrtc] ⚠️ Cannot set answer in state: ${pc.signalingState}`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`[webrtc] ✅ Set remote description (answer)`);
      await this._addBufferedCandidates(callId);
    } catch (err) {
      console.error("[webrtc] ❌ Failed to set answer", err);
    }
  }

  private async _handleIceCandidate(callId: string, candidateData: RTCIceCandidateInit) {
    const pc = this.pcs.get(callId);

    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (err) {
        console.warn("[webrtc] ⚠️ Failed to add ICE", err);
      }
    } else {
      // Buffer until remote description is set
      const buf = this.candidateBuffer.get(callId) || [];
      buf.push(candidateData);
      this.candidateBuffer.set(callId, buf);
    }
  }

  private async _addBufferedCandidates(callId: string) {
    const buffered = this.candidateBuffer.get(callId);
    if (!buffered || buffered.length === 0) return;

    console.log(`[webrtc] 📦 Adding ${buffered.length} buffered ICE candidates`);
    const pc = this.pcs.get(callId);
    if (!pc) return;

    for (const candidate of buffered) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[webrtc] ⚠️ Buffered candidate failed", e);
      }
    }
    this.candidateBuffer.delete(callId);
  }

  private async _createAndSendOffer(callId: string, remoteUserId: string) {
    const pc = this.pcs.get(callId);
    if (!pc) {
      console.error(`[webrtc] ❌ No PC for offer`);
      return;
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await pc.setLocalDescription(offer);
      console.log(`[webrtc] ✅ Created offer`);

      await this.sendSignal({
        type: "offer",
        from: this.currentUserId!,
        to: remoteUserId,
        callId,
        data: offer,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("[webrtc] ❌ createAndSendOffer failed", err);
      this.onError?.(err);
    }
  }

  // ----------
  // PUBLIC API: INITIATE CALL
  // ----------

  public async initiateCall(targetUserId: string, callType: CallType = "video"): Promise<{ localStream: MediaStream; callId: string }> {
    await this.ensureInitialized();
    if (!this.currentUserId) throw new Error("Not authenticated");

    const callId = `${this.currentUserId}-${targetUserId}-${Date.now()}`;
    console.log(`[webrtc] 📞 Initiating ${callType} call to ${targetUserId.slice(0, 8)}`);

    this.callIdToOtherUser.set(callId, targetUserId);
    this.callTypes.set(callId, callType);

    // Get local media with retry
    const localStream = await this._getMediaWithRetry(callType);
    this.localStreams.set(callId, localStream);
    this.localStream = localStream;

    // Send call request
    await this.sendSignal({
      type: "call-request",
      from: this.currentUserId,
      to: targetUserId,
      callId,
      data: { callType },
      timestamp: Date.now()
    });

    return { localStream, callId };
  }

  // ----------
  // PUBLIC API: ACCEPT CALL
  // ----------

  public async acceptCall(callId: string, callType?: CallType): Promise<MediaStream> {
    await this.ensureInitialized();
    if (!this.currentUserId) throw new Error("Not authenticated");
    if (!callId) throw new Error("callId required");

    console.log(`[webrtc] 📞 Accepting call: ${callId.slice(0, 16)}`);

    // Use stored call type or provided one
    const resolvedCallType = callType || this.callTypes.get(callId) || "video";

    // Get local media with retry
    const localStream = await this._getMediaWithRetry(resolvedCallType);
    this.localStreams.set(callId, localStream);
    this.localStream = localStream;

    const callerUserId = this._getOtherUserFromCallId(callId);
    if (!callerUserId) throw new Error("Cannot determine caller from callId");

    // Create PC and add tracks BEFORE sending accept
    this._createPC(callId, callerUserId);
    this._addLocalTracksToPC(callId);

    // Handle pending offer if it arrived before we accepted
    const pendingOffer = this.pendingOffers.get(callId);
    if (pendingOffer) {
      console.log(`[webrtc] 📦 Handling pending offer immediately`);
      await this._handleOffer(callId, pendingOffer, callerUserId);
    }

    // Tell caller we accepted
    await this.sendSignal({
      type: "call-accept",
      from: this.currentUserId,
      to: callerUserId,
      callId,
      timestamp: Date.now()
    });

    return localStream;
  }

  // ----------
  // MEDIA ACQUISITION WITH RETRY
  // ----------

  private async _getMediaWithRetry(callType: CallType, retries = 3): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === "video" ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: "user"
      } : false
    };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log(`[webrtc] ✅ Got local stream: ${stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', ')}`);
        return stream;
      } catch (err: any) {
        console.warn(`[webrtc] ⚠️ getUserMedia attempt ${attempt + 1} failed:`, err.name);

        // If video fails, try audio only
        if (callType === "video" && attempt === 0) {
          console.log(`[webrtc] 🔄 Retrying with lower video quality`);
          constraints.video = { width: 640, height: 480, facingMode: "user" };
          continue;
        }

        // If still fails, try audio only
        if (callType === "video" && attempt === 1) {
          console.log(`[webrtc] 🔄 Falling back to audio only`);
          constraints.video = false;
          continue;
        }

        throw new Error(`Camera/microphone access denied: ${err.name}`);
      }
    }

    throw new Error("Failed to access camera/microphone");
  }

  // ----------
  // PUBLIC API: REJECT / END / TOGGLE
  // ----------

  public rejectCall(callId: string) {
    const callerUserId = this._getOtherUserFromCallId(callId);
    if (!callerUserId || !this.currentUserId) return;

    console.log(`[webrtc] ❌ Rejecting call`);
    this.sendSignal({
      type: "call-reject",
      from: this.currentUserId,
      to: callerUserId,
      callId,
      timestamp: Date.now()
    }).catch(() => {});

    this._cleanupCall(callId);
  }

  public async endCall(callId?: string) {
    if (!this.currentUserId) return;

    if (callId) {
      console.log(`[webrtc] 🔚 Ending call: ${callId.slice(0, 16)}`);
      const other = this._getOtherUserFromCallId(callId);
      if (other) {
        await this.sendSignal({
          type: "call-end",
          from: this.currentUserId,
          to: other,
          callId,
          timestamp: Date.now()
        });
      }
      this._cleanupCall(callId);
    } else {
      for (const cid of Array.from(this.pcs.keys())) {
        await this.endCall(cid);
      }
    }
  }

  public toggleAudio(enabled: boolean, callId?: string) {
    if (callId) {
      this.localStreams.get(callId)?.getAudioTracks().forEach(t => { t.enabled = enabled; });
    } else {
      for (const s of this.localStreams.values()) {
        s.getAudioTracks().forEach(t => { t.enabled = enabled; });
      }
    }
  }

  public toggleVideo(enabled: boolean, callId?: string) {
    if (callId) {
      this.localStreams.get(callId)?.getVideoTracks().forEach(t => { t.enabled = enabled; });
    } else {
      for (const s of this.localStreams.values()) {
        s.getVideoTracks().forEach(t => { t.enabled = enabled; });
      }
    }
  }

  // ----------
  // CLEANUP
  // ----------

  private _cleanupCall(callId: string) {
    console.log(`[webrtc] 🧹 Cleaning up: ${callId.slice(0, 16)}`);

    this._clearConnectionTimeout(callId);
    this.iceRestartAttempts.delete(callId);

    const pc = this.pcs.get(callId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.onicegatheringstatechange = null;
        pc.close();
      } catch {}
      this.pcs.delete(callId);
    }

    const rs = this.remoteStreams.get(callId);
    if (rs) {
      rs.getTracks().forEach(t => { try { t.stop(); } catch {} });
      this.remoteStreams.delete(callId);
    }

    const ls = this.localStreams.get(callId);
    if (ls) {
      ls.getTracks().forEach(t => { try { t.stop(); } catch {} });
      this.localStreams.delete(callId);
    }

    if (this.localStreams.size === 0) {
      this.localStream = null;
    }

    this.candidateBuffer.delete(callId);
    this.callIdToOtherUser.delete(callId);
    this.callTypes.delete(callId);
    this.pendingOffers.delete(callId);
  }

  public async shutdown() {
    console.log(`[webrtc] 🛑 Shutting down`);
    for (const cid of Array.from(this.pcs.keys())) {
      this._cleanupCall(cid);
    }
    if (this.channel) {
      try { await this.channel.unsubscribe(); } catch {}
      this.channel = null;
    }
    if (this.globalChannel) {
      try { await this.globalChannel.unsubscribe(); } catch {}
      this.globalChannel = null;
    }

    this.currentUserId = null;
    this.initialized = false;
    this.initializingPromise = null;
    this.callIdToOtherUser.clear();
    this.callTypes.clear();
    this.localStream = null;
    this.pendingOffers.clear();
    this.connectionTimeouts.clear();
    this.iceRestartAttempts.clear();
  }

  // ----------
  // GETTERS
  // ----------

  public getPeerConnection(callId: string): RTCPeerConnection | undefined {
    return this.pcs.get(callId);
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(callId?: string): MediaStream | null {
    if (callId) return this.remoteStreams.get(callId) ?? null;
    const first = this.remoteStreams.values().next();
    return first.done ? null : first.value;
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;