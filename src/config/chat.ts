export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_BATCH_FILES: 60,
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  MESSAGES_PER_PAGE: 50,
  RATE_LIMIT_MS: 1000,
  TYPING_THROTTLE_MS: 2000,
  TYPING_TIMEOUT_MS: 3000,
  CALL_TIMEOUT_MS: 45000,
  ONLINE_HEARTBEAT_MS: 60000,
  SIGNED_URL_EXPIRY: 60 * 60 * 24 * 7,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
  ALLOWED_AUDIO_TYPES: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav'],
} as const;

export const CALL_ICE_SERVERS: RTCIceServer[] = [
  // STUN (free, unlimited)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN — Open Relay Project (free 20GB/month)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];