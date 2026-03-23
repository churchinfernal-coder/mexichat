import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { DeliveryState } from '@/hooks/useDeliveryStatus';

export interface MessageStatusIconProps {
  status: DeliveryState;
  size?: number;
}

const MessageStatusIcon: React.FC<MessageStatusIconProps> = ({ status, size = 14 }) => {
  switch (status) {
    case 'sending':
      return <Clock size={size} style={{ color: 'var(--mc-text-muted)', opacity: 0.5 }} />;
    case 'sent':
      return <Check size={size} style={{ color: 'var(--mc-text-muted)' }} />;
    case 'delivered':
      return <CheckCheck size={size} style={{ color: 'var(--mc-text-muted)' }} />;
    case 'read':
      return <CheckCheck size={size} style={{ color: '#3b82f6' }} />;
    case 'failed':
      return <AlertCircle size={size} style={{ color: 'var(--mc-blue)' }} />;
    default:
      return <Check size={size} style={{ color: 'var(--mc-text-muted)' }} />;
  }
};

export default MessageStatusIcon;