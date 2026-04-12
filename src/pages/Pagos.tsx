import { verifyForPayment } from '@/services/biometric';
import {
useState, useEffect, useRef, useCallback } from 'react';
import {
useAuth } from '@/contexts/AuthContext';
import {
supabase } from '@/integrations/supabase/client';
import {
usePagos, type Transaction, type SendPayload } from '@/hooks/usePagos';
import {
createPayment,
  createOXXOPayment,
  searchContacts,
  MexiPayError,
  type ContactResult,
  type TxProvider,
} from '@/lib/mercadopago';
import {
ArrowLeft, Send, Clock, CheckCircle, XCircle, RefreshCw,
  Search, User, Store, CreditCard, ChevronDown, X, Loader2,
  ExternalLink, Copy, Check,
} from 'lucide-react';

export default function Pagos() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'enviar' | 'historial' | 'cuenta'>('enviar');

  // Send form state
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<ContactResult[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState<'mercadopago' | 'oxxo'>('mercadopago');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // OXXO result state
  const [oxxoTicket, setOxxoTicket] = useState<{
    ticket_url: string; barcode: string; expiration_date: string;
  } | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState(false);

  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Hook
  const { transactions, loading, sending, error, hasMore, sendTransaction, loadMore, refresh, clearError } = usePagos(user?.id);

  // ----------

  const handleContactSearch = useCallback(async (query: string) => {
    setContactQuery(query);
    setSelectedContact(null);
    setFormError(null);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (query.trim().length < 2) {
      setContactResults([]);
      setShowContactDropdown(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchingContacts(true);
      try {
        const results = await searchContacts(query);
        // Filter out self
        const filtered = results.filter(c => c.id !== user?.id);
        setContactResults(filtered);
        setShowContactDropdown(filtered.length > 0);
      } catch {
        setContactResults([]);
      } finally {
        setSearchingContacts(false);
      }
    }, 300);
  }, [user?.id]);

  const selectContact = (contact: ContactResult) => {
    setSelectedContact(contact);
    setContactQuery(contact.full_name || contact.username);
    setShowContactDropdown(false);
    setContactResults([]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ----------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setOxxoTicket(null);

    if (!user) { setFormError('Inicia sesion primero'); return; }
    if (!selectedContact) { setFormError('Selecciona un destinatario'); return; }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount < 10) {
      setFormError('Monto minimo: $10 MXN');
      return;
    }
    if (numAmount > 500000) {
      setFormError('Monto maximo: $500,000 MXN');
      return;
    }
    if (provider === 'oxxo' && numAmount > 10000) {
      setFormError('Monto maximo para OXXO: $10,000 MXN');
      return;
    }

    setSubmitting(true);

    try {
      const idempotencyKey = `mc-${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

      if (provider === 'mercadopago') {
        // Create MP checkout preference
        const result = await createPayment({
          receiver_id: selectedContact.id,
          amount: numAmount,
          description: description || 'Pago via MexiChat',
          idempotency_key: idempotencyKey,
        });

        const checkoutUrl = window.location.hostname === 'localhost'
          ? result.sandbox_url
          : result.checkout_url;
        window.location.href = checkoutUrl;
        return;
      }

      // Biometric gate for payment confirmation
    const bioOk = await verifyForPayment(numAmount);
    if (!bioOk) { setFormError('Verificacion biometrica cancelada'); setSubmitting(false); return; }

    if (provider === 'oxxo') {
        const result = await createOXXOPayment({
          receiver_id: selectedContact.id,
          amount: numAmount,
          description: description || 'Pago via MexiChat (OXXO)',
          payer_email: user.email ?? '',
          idempotency_key: idempotencyKey,
        });

        setOxxoTicket({
          ticket_url: result.ticket_url,
          barcode: result.barcode,
          expiration_date: result.expiration_date,
        });
        setFormSuccess('Referencia OXXO creada. Paga en cualquier tienda OXXO.');
        // Also record in usePagos
        await sendTransaction({
          receiverId: selectedContact.id,
          amount: numAmount,
          provider: 'oxxo',
          description: description || 'Pago via MexiChat (OXXO)',
          idempotencyKey,
          providerTxId: result.transaction_id,
          providerData: { ticket_url: result.ticket_url, barcode: result.barcode },
        });
        return;
      }
    } catch (err) {
      if (err instanceof MexiPayError) {
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : 'Error procesando pago');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyBarcode = async () => {
    if (oxxoTicket?.barcode) {
      await navigator.clipboard.writeText(oxxoTicket.barcode);
      setCopiedBarcode(true);
      setTimeout(() => setCopiedBarcode(false), 2000);
    }
  };

  const resetForm = () => {
    setSelectedContact(null);
    setContactQuery('');
    setAmount('');
    setDescription('');
    setFormError(null);
    setFormSuccess(null);
    setOxxoTicket(null);
    setProvider('mercadopago');
  };

  // ----------

  const statusIcon = (s: string) => {
    switch (s) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': case 'in_process': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
      cancelled: 'Cancelado', refunded: 'Reembolsado', in_process: 'En proceso',
      charged_back: 'Contracargo',
    };
    return labels[s] || s;
  };

  const providerLabel = (p: string) => {
    return p === 'oxxo' ? 'OXXO' : 'Mercado Pago';
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  // ----------

  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('mp_auth').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
      .then(({ data }) => setMpConnected(!!data));
  }, [user?.id]);

  // ----------

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <CreditCard className="w-16 h-16 text-blue-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Pagos MexiChat</h2>
        <p className="text-gray-500">Inicia sesion para usar pagos</p>
      </div>
    );
  }

  if (mpConnected === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <CreditCard className="w-16 h-16 text-blue-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Vincula Mercado Pago</h2>
        <p className="text-gray-600 mb-4 text-center">Vincula tu cuenta para enviar y recibir pagos</p>
        <a href="/pagos/oauth-connect" className="bg-[#009ee3] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#0082c3] transition">
          Conectar Mercado Pago
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <a href="/" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></a>
        <CreditCard className="w-5 h-5 text-blue-500" />
        <span className="text-gray-400 text-lg ml-2">Pagos</span>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 p-3 bg-white border-b">
        {([
          { key: 'enviar', icon: <Send className="w-4 h-4" />, label: 'Enviar' },
          { key: 'historial', icon: <Clock className="w-4 h-4" />, label: 'Historial' },
          { key: 'cuenta', icon: <User className="w-4 h-4" />, label: 'Cuenta' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ${
              activeTab === tab.key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* ---------- */}
        {activeTab === 'enviar' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Contact Picker */}
            <div ref={contactDropdownRef} className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Destinatario</label>
              {selectedContact ? (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  {selectedContact.avatar_url ? (
                    <img src={selectedContact.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                      {(selectedContact.full_name || selectedContact.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selectedContact.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">@{selectedContact.username}</p>
                  </div>
                  <button type="button" onClick={() => { setSelectedContact(null); setContactQuery(''); }}
                    className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={contactQuery}
                    onChange={(e) => handleContactSearch(e.target.value)}
                    placeholder="Buscar por nombre, @usuario o telefono..."
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm"
                    autoComplete="off"
                  />
                  {searchingContacts && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
              )}

              {/* Contact Dropdown */}
              {showContactDropdown && contactResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {contactResults.map(contact => (
                    <button key={contact.id} type="button" onClick={() => selectContact(contact)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition text-left">
                      {contact.avatar_url ? (
                        <img src={contact.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                          {(contact.full_name || contact.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{contact.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">@{contact.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Monto (MXN)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setFormError(null); }}
                  placeholder="10.00"
                  min="10" max="500000" step="0.01"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Minimo $10 MXN{provider === 'oxxo' ? ' | Maximo $10,000 OXXO' : ''}</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Concepto (opcional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Pago de comida"
                maxLength={280}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Metodo de pago</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setProvider('mercadopago')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition text-sm font-medium ${
                    provider === 'mercadopago'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  <CreditCard className="w-5 h-5" />
                  <div className="text-left">
                    <p>Mercado Pago</p>
                    <p className="text-xs font-normal text-gray-400">Tarjeta, saldo MP</p>
                  </div>
                </button>
                <button type="button" onClick={() => setProvider('oxxo')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition text-sm font-medium ${
                    provider === 'oxxo'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  <Store className="w-5 h-5" />
                  <div className="text-left">
                    <p>OXXO</p>
                    <p className="text-xs font-normal text-gray-400">Pago en efectivo</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Error / Success */}
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" /> {formError}
              </div>
            )}
            {formSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" /> {formSuccess}
              </div>
            )}

            {/* OXXO Ticket Display */}
            {oxxoTicket && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-orange-800 flex items-center gap-2">
                  <Store className="w-5 h-5" /> Referencia OXXO
                </h3>
                {oxxoTicket.barcode && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Codigo de barras:</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-white px-3 py-2 rounded border text-sm font-mono flex-1 truncate">
                        {oxxoTicket.barcode}
                      </code>
                      <button type="button" onClick={copyBarcode} className="p-2 hover:bg-orange-100 rounded transition">
                        {copiedBarcode ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Vence: {formatDate(oxxoTicket.expiration_date)}
                </p>
                {oxxoTicket.ticket_url && (
                  <a href={oxxoTicket.ticket_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium">
                    <ExternalLink className="w-4 h-4" /> Ver voucher completo
                  </a>
                )}
                <button type="button" onClick={resetForm}
                  className="w-full mt-2 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">
                  Enviar otro pago
                </button>
              </div>
            )}

            {/* Submit */}
            {!oxxoTicket && (
              <button type="submit" disabled={submitting || !selectedContact || !amount || parseFloat(amount) < 10}
                className="w-full py-3 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: provider === 'oxxo' ? '#f97316' : '#3b82f6' }}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar ${amount ? parseFloat(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'} MXN</>
                )}
              </button>
            )}
          </form>
        )}

        {/* ---------- */}
        {activeTab === 'historial' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Historial de transacciones</h3>
              <button onClick={refresh} className="text-blue-500 hover:text-blue-700 p-1">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}
                <button onClick={clearError} className="ml-2 underline">Cerrar</button>
              </div>
            )}

            {loading && transactions.length === 0 && (
              <div className="text-center py-8 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando...</div>
            )}
            {!loading && transactions.length === 0 && (
              <div className="text-center py-8 text-gray-400">No tienes transacciones aun</div>
            )}

            {transactions.map((tx) => {
              const isSender = tx.sender_id === user?.id;
              const other = isSender ? tx.receiver : tx.sender;
              const otherName = other?.full_name || other?.username || (isSender ? tx.receiver_id.slice(0, 8) : tx.sender_id.slice(0, 8));

              return (
                <div key={tx.id} className="bg-white rounded-lg border p-3 flex items-center gap-3">
                  {other?.avatar_url ? (
                    <img src={other.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                      {otherName[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {isSender ? `Enviado a ${otherName}` : `Recibido de ${otherName}`}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {statusIcon(tx.status)} <span>{statusLabel(tx.status)}</span>
                      <span>·</span>
                      <span>{providerLabel(tx.provider)}</span>
                      <span>·</span>
                      <span>{formatDate(tx.created_at)}</span>
                    </div>
                    {tx.description && <p className="text-xs text-gray-400 truncate mt-0.5">{tx.description}</p>}
                  </div>
                  <span className={`font-bold text-sm ${isSender ? 'text-red-500' : 'text-green-500'}`}>
                    {isSender ? '-' : '+'}${tx.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}

            {hasMore && (
              <button onClick={loadMore} className="w-full py-2 text-blue-500 text-sm hover:underline">
                Cargar mas
              </button>
            )}
          </div>
        )}

        {/* ---------- */}
        {activeTab === 'cuenta' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-700 mb-2">Mercado Pago</h3>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${mpConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {mpConnected ? 'Cuenta vinculada' : 'No vinculada'}
                </span>
              </div>
              {!mpConnected && (
                <a href="/pagos/oauth-connect"
                  className="mt-3 inline-block bg-[#009ee3] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0082c3] transition">
                  Conectar
                </a>
              )}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-700 mb-2">Metodos de pago disponibles</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  <span>Mercado Pago — Tarjeta, saldo, transferencia</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Store className="w-5 h-5 text-orange-500" />
                  <span>OXXO — Pago en efectivo en tienda</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-400 text-center">
              Comision de servicio: $5 MXN por transaccion
            </div>
          </div>
        )}
      </div>
    </div>
  );
}