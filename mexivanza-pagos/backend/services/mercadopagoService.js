const axios = require("axios");
const UserMPAuth = require("../models/UserMPAuth");

const MP_API_BASE = "https://api.mercadopago.com";

class MercadoPagoService {

  // ─── OAuth: Exchange authorization code for tokens ───
  static async exchangeCodeForTokens(authorizationCode) {
    const response = await axios.post(`${MP_API_BASE}/oauth/token`, {
      client_id:     process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type:    "authorization_code",
      code:          authorizationCode,
      redirect_uri:  process.env.MP_REDIRECT_URI,
    });
    return response.data;
    // Returns: { access_token, token_type, expires_in, scope, user_id, refresh_token, public_key }
  }

  // ─── OAuth: Refresh expired token ───
  static async refreshAccessToken(refreshToken) {
    const response = await axios.post(`${MP_API_BASE}/oauth/token`, {
      client_id:     process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    });
    return response.data;
  }

  // ─── Get valid access token for a user (auto-refresh if expired) ───
  static async getValidToken(userId) {
    const auth = await UserMPAuth.findOne({ userId, isActive: true });
    if (!auth) throw new Error("Usuario no tiene cuenta Mercado Pago vinculada");

    // If token expires in less than 5 minutes, refresh it
    const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (auth.tokenExpiresAt < fiveMinFromNow) {
      const refreshed = await this.refreshAccessToken(auth.mpRefreshToken);
      auth.mpAccessToken  = refreshed.access_token;
      auth.mpRefreshToken = refreshed.refresh_token;
      auth.tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
      await auth.save();
    }

    return auth.mpAccessToken;
  }

  // ─── Create a payment / transfer ───
  // This creates a payment where the sender pays to the receiver's MP account
  static async createTransfer({ senderAccessToken, receiverEmail, amount, description }) {
    const response = await axios.post(
      `${MP_API_BASE}/v1/payments`,
      {
        transaction_amount: amount,
        description:        description || "Transferencia via MexiChat",
        payment_method_id:  "account_money", // Uses MP account balance
        payer: {
          email: receiverEmail, // This is simplified; real flow uses preference + checkout
        },
      },
      {
        headers: {
          Authorization: `Bearer ${senderAccessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `mexichat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      }
    );
    return response.data;
  }

  // ─── Create a Checkout Preference (for card payments) ───
  // Luisa gets a checkout UI to pay Maria
  static async createPreference({ senderAccessToken, receiverMPUserId, amount, description, senderEmail, receiverEmail }) {
    const response = await axios.post(
      `${MP_API_BASE}/checkout/preferences`,
      {
        items: [
          {
            title:       description || "Pago via MexiChat",
            quantity:    1,
            unit_price:  amount,
            currency_id: "MXN",
          },
        ],
        payer: {
          email: senderEmail,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL || "http://localhost:3000"}/pagos/success`,
          failure: `${process.env.FRONTEND_URL || "http://localhost:3000"}/pagos/failure`,
          pending: `${process.env.FRONTEND_URL || "http://localhost:3000"}/pagos/pending`,
        },
        auto_return:       "approved",
        notification_url:  `${process.env.BACKEND_URL || "http://localhost:3001"}/api/webhooks/mercadopago`,
        marketplace_fee:   0,   // Set a fee here if you want to earn commission
        collector_id:      receiverMPUserId, // Money goes to receiver's account
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, // Your marketplace token
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  }

  // ─── Get payment status ───
  static async getPaymentStatus(paymentId, accessToken) {
    const response = await axios.get(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  }
}

module.exports = MercadoPagoService;
