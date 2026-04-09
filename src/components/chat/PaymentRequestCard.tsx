/**
 * MEXICHAT - Payment Request Card v1.0
 * Inline card shown in chat for payment requests.
 */
import React from 'react';
import { DollarSign, Check, X, Clock, Ban, CreditCard } from 'lucide-react';
import type { PaymentRequest, PaymentRequestStatus } from '@/hooks/usePaymentRequests';

interface PaymentRequestCardProps {
  request: PaymentRequest;
  currentUserId: string;
  requesterName: string;
  onPay?: (request: PaymentRequest) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const STATUS_CONFIG: Record<PaymentRequestStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  paid: { label: 'Pagado', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  declined: { label: 'Rechazado', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  cancelled: { label: 'Cancelado', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  expired: { label: 'Expirado', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
};

function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(amount);
}

const PaymentRequestCard: React.FC<PaymentRequestCardProps> = ({
  request, currentUserId, requesterName, onPay, onDecline, onCancel,
}) => {
  const isRequester = request.requesterId === currentUserId;
  const isPayer = request.payerId === currentUserId;
  const isPending = request.status === 'pending';
  const isExpired = new Date(request.expiresAt).getTime() < Date.now();
  const statusKey = (isExpired && isPending) ? 'expired' : request.status;
  const status = STATUS_CONFIG[statusKey];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0fdfa 100%)',
      border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 16px', maxWidth: '280px', margin: '4px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
        }}><DollarSign size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            {isRequester ? 'Solicitaste pago' : requesterName + ' solicita'}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
            {formatMXN(request.amount)}
          </div>
        </div>
      </div>
      {request.description && (
        <div style={{
          fontSize: '13px', color: '#475569', padding: '8px 10px',
          background: 'rgba(255,255,255,0.7)', borderRadius: '8px', marginBottom: '10px',
        }}>{request.description}</div>
      )}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
        fontWeight: 700, color: status.color, background: status.bg,
        marginBottom: (isPending && !isExpired) ? '10px' : '0',
      }}>{status.label}</div>
      {isPending && !isExpired && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          {isPayer && onPay && (
            <button onClick={() => onPay(request)} style={{
              flex: 1, padding: '8px', background: '#22c55e', border: 'none',
              borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}><CreditCard size={14} /> Pagar</button>
          )}
          {isPayer && onDecline && (
            <button onClick={() => onDecline(request.id)} style={{
              padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid #fecaca',
              borderRadius: '8px', color: '#ef4444', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}>Rechazar</button>
          )}
          {isRequester && onCancel && (
            <button onClick={() => onCancel(request.id)} style={{
              flex: 1, padding: '8px', background: 'rgba(148,163,184,0.1)', border: '1px solid #e2e8f0',
              borderRadius: '8px', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}>Cancelar</button>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentRequestCard;