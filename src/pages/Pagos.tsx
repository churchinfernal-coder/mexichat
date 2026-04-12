import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Send, Clock, CheckCircle, XCircle,
  CreditCard, Store, Loader2,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cchakgecusfybcokbmau.supabase.co';
const SERVICE_FEE_MXN = 5;
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 500000;
const MAX_OXXO = 10000;

interface Transaction {
  id: string;
  amount: number;
  status: string;
  provider: string;
  description: string;
  created_at: string;
}

type PaymentProvider = 'mercadopago' | 'oxxo';
type TabType = 'enviar' | 'historial';

export default function Pagos() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('enviar');

  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [provider, setProvider] = useState<PaymentProvider>('mercadopago');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyLoaded, setHistoryLoaded] = useState<boolean>(false);

  const parsedAmount = parseFloat(amount) || 0;
  const totalWithFee = parsedAmount > 0 ? parsedAmount + SERVICE_FEE_MXN : 0;
  const isValidAmount = parsedAmount >= MIN_AMOUNT && parsedAmount <= MAX_AMOUNT;
  const isOxxoValid = provider !== 'oxxo' || parsedAmount <= MAX_OXXO;

  const generateIdempotencyKey = useCallback((): string => {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    return `mxc-${timestamp}-${randomPart}`;
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      setFormError(null);
    }
  }, []);

  const handleProviderChange = useCallback((newProvider: PaymentProvider) => {
    setProvider(newProvider);
    setFormError(null);
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!user) return 'Inicia sesión primero';
    if (!amount || parsedAmount < MIN_AMOUNT) return `Monto mínimo: $${MIN_AMOUNT} MXN`;
    if (parsedAmount > MAX_AMOUNT) return `Monto máximo: $${MAX_AMOUNT.toLocaleString('es-MX')} MXN`;
    if (provider === 'oxxo' && parsedAmount > MAX_OXXO) {
      return `Monto máximo para OXXO: $${MAX_OXXO.toLocaleString('es-MX')} MXN`;
    }
    return null;
  }, [user, amount, parsedAmount, provider]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        setFormError('Sesión expirada. Inicia sesión de nuevo.');
        return;
      }

      const payload = {
        amount: parsedAmount,
        fee: SERVICE_FEE_MXN,
        total: totalWithFee,
        description: description.trim() || 'Pago via MexiChat',
        provider,
        idempotency_key: generateIdempotencyKey(),
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        const errorMessage = json?.error?.message || json?.error || json?.message || 'Error procesando pago';
        setFormError(errorMessage);
        return;
      }

      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const checkoutUrl = isLocalhost
        ? (json.data?.sandbox_url || json.sandbox_url)
        : (json.data?.checkout_url || json.checkout_url);

      if (checkoutUrl && typeof checkoutUrl === 'string') {
        window.location.href = checkoutUrl;
      } else {
        setFormError('No se recibió URL de pago válida');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexión. Intenta de nuevo.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }, [validateForm, parsedAmount, totalWithFee, description, provider, generateIdempotencyKey]);

  const loadHistory = useCallback(async () => {
    if (!user || loadingHistory) return;
    
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, status, provider, description, created_at')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setTransactions(data as Transaction[]);
      }
    } catch {
      // Silent fail for history load
    } finally {
      setLoadingHistory(false);
      setHistoryLoaded(true);
    }
  }, [user, loadingHistory]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'historial' && !historyLoaded) {
      loadHistory();
    }
  }, [historyLoaded, loadHistory]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
      case 'in_process':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      cancelled: 'Cancelado',
      refunded: 'Reembolsado',
      in_process: 'En proceso',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <CreditCard className="w-16 h-16 text-blue-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Pagos MexiChat</h2>
        <p className="text-gray-500">Inicia sesión para usar pagos</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <a href="/" className="text-gray-500 hover:text-gray-700" aria-label="Volver">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <CreditCard className="w-5 h-5 text-blue-500" />
        <span className="text-gray-700 text-lg font-medium">Pagos</span>
      </header>

      <nav className="flex justify-center gap-2 p-3 bg-white border-b">
        <button
          type="button"
          onClick={() => handleTabChange('enviar')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ${
            activeTab === 'enviar'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          aria-selected={activeTab === 'enviar'}
        >
          <Send className="w-4 h-4" /> Pagar
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('historial')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ${
            activeTab === 'historial'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          aria-selected={activeTab === 'historial'}
        >
          <Clock className="w-4 h-4" /> Historial
        </button>
      </nav>

      <main className="max-w-lg mx-auto p-4">
        {activeTab === 'enviar' && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-1">
                Monto (MXN)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-lg"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Mínimo ${MIN_AMOUNT} MXN
                {provider === 'oxxo' && ` · Máximo $${MAX_OXXO.toLocaleString('es-MX')} OXXO`}
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1">
                Concepto (opcional)
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Recarga de saldo"
                maxLength={280}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm"
                autoComplete="off"
              />
            </div>

            <fieldset>
              <legend className="block text-sm font-semibold text-gray-700 mb-1">Método de pago</legend>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleProviderChange('mercadopago')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition text-sm font-medium ${
                    provider === 'mercadopago'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                  aria-pressed={provider === 'mercadopago'}
                >
                  <CreditCard className="w-5 h-5" />
                  <div className="text-left">
                    <p>Mercado Pago</p>
                    <p className="text-xs font-normal text-gray-400">Tarjeta, saldo MP</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderChange('oxxo')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition text-sm font-medium ${
                    provider === 'oxxo'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                  aria-pressed={provider === 'oxxo'}
                >
                  <Store className="w-5 h-5" />
                  <div className="text-left">
                    <p>OXXO</p>
                    <p className="text-xs font-normal text-gray-400">Pago en efectivo</p>
                  </div>
                </button>
              </div>
            </fieldset>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2" role="alert">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {parsedAmount >= MIN_AMOUNT && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Monto:</span>
                  <span>${formatCurrency(parsedAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Comisión de servicio:</span>
                  <span>${formatCurrency(SERVICE_FEE_MXN)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-200">
                  <span>Total a pagar:</span>
                  <span>${formatCurrency(totalWithFee)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !isValidAmount || !isOxxoValid}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: provider === 'oxxo' ? '#f97316' : '#3b82f6' }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Pagar ${formatCurrency(totalWithFee)} MXN
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Comisión fija por transacción: ${SERVICE_FEE_MXN} MXN
            </p>
          </form>
        )}

        {activeTab === 'historial' && (
          <section className="space-y-3">
            <h3 className="font-semibold text-gray-700">Historial de pagos</h3>

            {loadingHistory && (
              <div className="text-center py-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Cargando...
              </div>
            )}

            {!loadingHistory && transactions.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No tienes pagos aún
              </div>
            )}

            {transactions.map((tx) => (
              <article key={tx.id} className="bg-white rounded-lg border p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {tx.description || 'Pago MexiChat'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {getStatusIcon(tx.status)}
                    <span>{getStatusLabel(tx.status)}</span>
                    <span>·</span>
                    <span>{formatDate(tx.created_at)}</span>
                  </div>
                </div>
                <span className="font-bold text-sm text-gray-700 flex-shrink-0">
                  ${formatCurrency(tx.amount)}
                </span>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}