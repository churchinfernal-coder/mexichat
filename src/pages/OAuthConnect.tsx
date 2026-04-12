import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cchakgecusfybcokbmau.supabase.co';

export default function OAuthConnect() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setError('No autenticado'); return; }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/oauth-connect`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        const authUrl = json?.data?.auth_url || json?.auth_url;

        if (authUrl) {
          window.location.href = authUrl;
        } else {
          setError('No se pudo obtener la URL de Mercado Pago');
        }
      } catch {
        setError('Error conectando con Mercado Pago');
      }
    })();
  }, [user]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <p className="text-red-600 mb-4">{error}</p>
        <a href="/pagos" className="text-blue-500 underline">Volver a Pagos</a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
      <p className="text-gray-600">Conectando con Mercado Pago...</p>
    </div>
  );
}