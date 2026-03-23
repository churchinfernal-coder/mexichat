const mongoose = require("mongoose");

const userMPAuthSchema = new mongoose.Schema(
  {
    // MexiChat internal user ID
    userId: { type: String, required: true, unique: true, index: true },

    // Mercado Pago OAuth tokens
    mpAccessToken:  { type: String, required: true },
    mpRefreshToken: { type: String, required: true },
    mpUserId:       { type: String },
    mpEmail:        { type: String },
    mpPublicKey:    { type: String },

    // Token management
    tokenExpiresAt: { type: Date, required: true },
    scopes:         [{ type: String }],

    // Status
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserMPAuth", userMPAuthSchema);
