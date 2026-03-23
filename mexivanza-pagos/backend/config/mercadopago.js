const { MercadoPagoConfig } = require("mercadopago");

// Creates a configured MP client instance
// Each user will have their own access_token from OAuth
function createMPClient(accessToken) {
  return new MercadoPagoConfig({
    accessToken: accessToken || process.env.MP_ACCESS_TOKEN,
    options: { timeout: 5000 },
  });
}

module.exports = { createMPClient };
