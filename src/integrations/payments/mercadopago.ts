/**
 * MexiChat – Mercado Pago facilitator wrapper
 * MexiChat never handles raw card data – all tokenized by MP SDK
 */

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY ?? '';
const MP_OAUTH_URL  = 'https://auth.mercadopago.com/authorization';
const MP_CLIENT_ID  = import.meta.env.VITE_MP_CLIENT_ID ?? '';

function getRedirectUri() { 
  try { 
    return window.location.origin + '/pagos/callback'; 
  } catch { 
    return 'https://mexichat.app/pagos/callback'; 
  } 
}   

export type Provider = 'mercadopago' | 'oxxo' | 'paypal';

export interface InitiatePayload {
  receiverId: string;
  receiverEmail: string;
  amount: number;
  currency: 'MXN' | 'USD';
  description: string;
  provider: Provider;
  chatId?: string;
}

export interface TransactionResult {
  providerTxId: string;
  status: 'pending' | 'approved' | 'rejected';   
  providerData: Record<string, unknown>;
}

/** Load Mercado Pago SDK dynamically – only when needed */
export async function loadMPSdk(): Promise<void> {
  if ((window as any).MercadoPago) return;       
  await new Promise<void>((resolve, reject) => { 
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Mercado Pago SDK'));
    document.head.appendChild(script);
  });
}

/** Redirect user to MP OAuth to authorize MexiChat */
export function redirectToMPOAuth(): void {      
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: MP_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    state: crypto.randomUUID(),
  });
  window.location.href = `${MP_OAUTH_URL}?${params}`;
}

/** Get MP instance (must call loadMPSdk first) */
export function getMPInstance() {
  const MP = (window as any).MercadoPago;        
  if (!MP) throw new Error('SDK no cargado');    
  return new MP(MP_PUBLIC_KEY, { locale: 'es-MX' });
}

/** Generate OXXO payment reference via your backend proxy */
export async function createOXXOReference(payload: InitiatePayload): Promise<TransactionResult> { 
  const res = await fetch('/api/pagos/oxxo', {   
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Error generando referencia OXXO');
  }
  return res.json();
}

/** Initiate PayPal order via backend proxy */   
export async function createPayPalOrder(payload: InitiatePayload): Promise<TransactionResult> {   
  const res = await fetch('/api/pagos/paypal', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Error creando orden PayPal');
  }
  return res.json();
}