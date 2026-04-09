/**
 * MEXICHAT - Payment Request Creator Modal
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, X, Send } from 'lucide-react';

interface PaymentRequestModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (amount: number, description: string) => void;
  recipientName?: string;
}

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 5000];

const PaymentRequestModal: React.FC<PaymentRequestModalProps> = ({
  open, onClose, onCreate, recipientName,
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) { setAmount(''); setDescription(''); }
  }, [open]);

  if (!open) return null;

  const numAmount = parseFloat(amount);
  const isValid = !isNaN(numAmount) && numAmount > 0 && numAmount <= 50000;

  const handleSubmit = () => {
    if (!isValid) return;
    onCreate(numAmount, description);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 110,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px',
        border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>
              <DollarSign size={16} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Solicitar pago</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {recipientName && (
            <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
              Solicitar a <strong>{recipientName}</strong>
            </div>
          )}

          {/* Amount input */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ fontSize: '28px', color: '#94a3b8', fontWeight: 300 }}>$</span>
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" autoFocus min="1" max="50000" step="0.01"
                style={{
                  fontSize: '36px', fontWeight: 800, color: '#0f172a', border: 'none',
                  outline: 'none', textAlign: 'center', width: '200px', background: 'transparent',
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>MXN</div>
          </div>

          {/* Quick amounts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {QUICK_AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmount(String(a))} style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                border: amount === String(a) ? '2px solid #22c55e' : '1px solid #e2e8f0',
                background: amount === String(a) ? 'rgba(34,197,94,0.08)' : '#f8fafc',
                color: amount === String(a) ? '#16a34a' : '#0f172a',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                ${a.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>
              Concepto (opcional)
            </label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Mitad de la cuenta, renta, etc."
              style={{
                width: '100%', padding: '10px 14px', background: '#f1f5f9',
                border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={!isValid} style={{
            padding: '12px', background: isValid ? '#22c55e' : '#e2e8f0',
            border: 'none', borderRadius: '10px', color: isValid ? 'white' : '#94a3b8',
            fontWeight: 700, fontSize: '15px', cursor: isValid ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.15s',
          }}>
            <Send size={16} /> Enviar solicitud
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequestModal;