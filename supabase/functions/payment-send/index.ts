import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;

const MEXICHAT_FEE_MXN = 5; // MexiChat takes $5 MXN per transaction

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const senderId = user.id;

    // Body
    const { receiver_id, amount, description, idempotency_key } = await req.json();

    if (!receiver_id || !amount || !idempotency_key) {
      throw new Error("Faltan campos requeridos");
    }
    if (amount < 10) throw new Error("Monto minimo: $10 MXN");
    if (amount > 500000) throw new Error("Monto maximo: $500,000 MXN");
    if (receiver_id === senderId) throw new Error("No puedes enviarte dinero a ti mismo");

    // Get receiver's MP credentials
    const { data: receiverAuth, error: receiverError } = await supabase
      .from("mp_auth")
      .select("mp_access_token, mp_user_id")
      .eq("user_id", receiver_id)
      .eq("is_active", true)
      .maybeSingle();

    if (receiverError || !receiverAuth?.mp_access_token) {
      throw new Error("El destinatario no tiene Mercado Pago vinculado");
    }

    // Check idempotency
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id, status, provider_data")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingTx) {
      return new Response(JSON.stringify({
        data: {
          transaction_id: existingTx.id,
          status: existingTx.status,
          checkout_url: existingTx.provider_data?.checkout_url || "",
          sandbox_url: existingTx.provider_data?.sandbox_url || "",
          preference_id: existingTx.provider_data?.preference_id || "",
          idempotent_replay: true,
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get sender profile for external_reference
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", senderId)
      .maybeSingle();

    const senderName = senderProfile?.full_name || senderProfile?.username || "Usuario";

    // Calculate split: receiver gets (amount - 5), MexiChat gets 5
    const receiverAmount = amount - MEXICHAT_FEE_MXN;

    // Create MP Preference with split payment (marketplace model)
    const preferenceBody = {
      items: [{
        title: description || `Pago de ${senderName}`,
        quantity: 1,
        unit_price: amount,
        currency_id: "MXN",
      }],
      marketplace_fee: MEXICHAT_FEE_MXN, // MexiChat takes $5
      back_urls: {
        success: `${req.headers.get("origin") || "https://mexichat.app"}/pagos?status=success`,
        failure: `${req.headers.get("origin") || "https://mexichat.app"}/pagos?status=failure`,
        pending: `${req.headers.get("origin") || "https://mexichat.app"}/pagos?status=pending`,
      },
      auto_return: "approved",
      external_reference: JSON.stringify({
        sender_id: senderId,
        receiver_id: receiver_id,
        idempotency_key: idempotency_key,
      }),
      notification_url: `${SUPABASE_URL}/functions/v1/payment-webhook`,
    };

    // Create preference using RECEIVER's access token (P2P)
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${receiverAuth.mp_access_token}`,
        "X-Idempotency-Key": idempotency_key,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP Error:", mpData);
      throw new Error(mpData.message || "Error creando preferencia de pago");
    }

    // Record transaction
    const { data: txData, error: txError } = await supabase
      .from("transactions")
      .insert({
        sender_id: senderId,
        receiver_id: receiver_id,
        amount: amount,
        fee: MEXICHAT_FEE_MXN,
        net_amount: receiverAmount,
        provider: "mercadopago",
        status: "pending",
        description: description || null,
        idempotency_key: idempotency_key,
        provider_tx_id: mpData.id,
        provider_data: {
          preference_id: mpData.id,
          checkout_url: mpData.init_point,
          sandbox_url: mpData.sandbox_init_point,
        },
      })
      .select("id")
      .single();

    if (txError) {
      console.error("TX Insert Error:", txError);
      throw new Error("Error guardando transaccion");
    }

    return new Response(JSON.stringify({
      data: {
        transaction_id: txData.id,
        status: "pending",
        checkout_url: mpData.init_point,
        sandbox_url: mpData.sandbox_init_point,
        preference_id: mpData.id,
        idempotent_replay: false,
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("payment-send error:", err);
    return new Response(JSON.stringify({
      error: { message: err.message, code: "PAYMENT_ERROR" }
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});