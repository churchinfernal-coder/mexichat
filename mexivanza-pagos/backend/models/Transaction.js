const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // MexiChat user IDs
    senderId:    { type: String, required: true, index: true },
    receiverId:  { type: String, required: true, index: true },

    // Mercado Pago references
    mpPaymentId:      { type: String, unique: true, sparse: true },
    mpTransferId:     { type: String },
    mpPreferenceId:   { type: String },

    // Transfer details
    amount:   { type: Number, required: true, min: 1 },
    currency: { type: String, default: "MXN" },

    // Status tracking
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled", "in_process", "refunded"],
      default: "pending",
    },

    // Metadata
    description:     { type: String },
    senderEmail:     { type: String },
    receiverEmail:   { type: String },
    errorDetail:     { type: String },
    webhookPayload:  { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Index for chat history queries
transactionSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
