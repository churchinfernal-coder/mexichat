import React from 'react';

interface TypingIndicatorProps {
  userName: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userName }) => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 16px', fontSize: '12px',
      color: 'var(--mc-text-muted)', fontStyle: 'italic',
    }}>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        <span className="typing-dot" style={{ animationDelay: '0ms' }} />
        <span className="typing-dot" style={{ animationDelay: '150ms' }} />
        <span className="typing-dot" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{userName} est&aacute; escribiendo...</span>
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
      `}</style>
    </div>
  );
};

export default TypingIndicator;