const express = require("express");
const router = express.Router();
const MercadoPagoService = require("../services/mercadopagoService");
const UserMPAuth = require("../models/UserMPAuth");
const { authenticateUser } = require("../middleware/auth");

// ─── Step 1: Redirect user to Mercado Pago OAuth ───
// GET /api/oauth/connect
router.get("/connect", authenticateUser, (req, res) => {
  const authUrl =
    `https://auth.mercadopago.com.mx/authorization?` +
    `client_id=${process.env.MP_CLIENT_ID}` +
    `&response_type=code` +
    `&platform_id=mp` +
    `&state=${req.user.userId}` +    // Pass MexiChat userId as state
    `&redirect_uri=${encodeURIComponent(process.env.MP_REDIRECT_URI)}`;

  res.json({ authUrl });
});

// ─── Step 2: OAuth Callback ───
// GET /api/oauth/callback?code=xxx&state=userId
router.get("/callback", async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.status(400).json({ error: "Código de autorización o estado faltante" });
    }

    // Exchange code for tokens
    const tokenData = await MercadoPagoService.exchangeCodeForTokens(code);

    // Save or update user's MP auth
    await UserMPAuth.findOneAndUpdate(
      { userId },
      {
        userId,
        mpAccessToken:  tokenData.access_token,
        mpRefreshToken: tokenData.refresh_token,
        mpUserId:       tokenData.user_id?.toString(),
        mpPublicKey:    tokenData.public_key,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        scopes:         tokenData.scope?.split(" ") || [],
        isActive:       true,
      },
      { upsert: true, new: true }
    );

    // Redirect back to MexiChat frontend
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/pagos?connected=true`);
  } catch (error) {
    console.error("❌ OAuth callback error:", error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/pagos?connected=false&error=oauth_failed`);
  }
});

// ─── Check connection status ───
// GET /api/oauth/status
router.get("/status", authenticateUser, async (req, res) => {
  const auth = await UserMPAuth.findOne({ userId: req.user.userId, isActive: true });
  res.json({
    connected:  !!auth,
    mpEmail:    auth?.mpEmail || null,
    connectedAt: auth?.createdAt || null,
  });
});

// ─── Disconnect Mercado Pago ───
// POST /api/oauth/disconnect
router.post("/disconnect", authenticateUser, async (req, res) => {
  await UserMPAuth.findOneAndUpdate(
    { userId: req.user.userId },
    { isActive: false }
  );
  res.json({ message: "Cuenta de Mercado Pago desvinculada" });
});

module.exports = router;
