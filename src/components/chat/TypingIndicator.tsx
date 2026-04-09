/**
 * MEXICHAT - Enhanced Typing Indicator v2.0
 * Shows different messages based on activity type.
 */

import React from 'react';
import type { ActivityType } from '@/hooks/useTyping';

interface TypingIndicatorProps {
  userName: string;
  activity?: ActivityType;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  typing: 'escribiendo...',
  recording: 'grabando audio...',
  location: 'compartiendo ubicacion...',
  uploading: 'enviando archivo...',
};

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  typing: '',
  recording: '\uD83C\uDFA4 ',
  location: '\uD83D\uDCCD ',
  uploading: '\uD83D\uDCC2 ',
};

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userName, activity = 'typing' }) => {
  const label = ACTIVITY_LABELS[activity] || ACTIVITY_LABELS.typing;
  const icon = ACTIVITY_ICONS[activity] || '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 16px', fontSize: '12px',
      color: 'var(--mc-text-muted)', fontStyle: 'italic',
    }}>
      {activity === 'typing' && (
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          <span className="typing-dot" style={{ animationDelay: '0ms' }} />
          <span className="typing-dot" style={{ animationDelay: '150ms' }} />
          <span className="typing-dot" style={{ animationDelay: '300ms' }} />
        </div>
      )}
      {activity === 'recording' && (
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#ef4444', animation: 'recordPulse 1s ease-in-out infinite',
        }} />
      )}
      {activity === 'location' && (
        <div style={{ animation: 'locationBounce 1s ease-in-out infinite' }}>
          {'\uD83D\uDCCD'}
        </div>
      )}
      {activity === 'uploading' && (
        <div style={{
          width: '14px', height: '14px', border: '2px solid var(--mc-text-muted)',
          borderTopColor: 'var(--mc-blue)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      )}
      <span>{icon}{userName} {label}</span>
      <style>{`
        .typing-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--mc-text-muted);
          animation: typingBounce 1.2s ease-in-out infinite;
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes recordPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes locationBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default TypingIndicator;