const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const axios = require("axios");
const Transaction = require("../models/Transaction");

// ─── Mercado Pago Webhook Handler ───
// POST /api/webhooks/mercadopago
router.post("/mercadopago", async (req, res) => {
  try {
    // Parse raw body (configured in server.js)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : JSON.parse(req.body.toString());

    console.log("📩 Webhook received:", JSON.stringify(body, null, 2));

    // Verify webhook signature (optional but recommended)
    const xSignature  = req.headers["x-signature"];
    const xRequestId  = req.headers["x-request-id"];

    if (xSignature && process.env.WEBHOOK_SECRET) {
      const parts     = Object.fromEntries(xSignature.split(",").map(p => p.trim().split("=")));
      const ts        = parts["ts"];
      const hash      = parts["v1"];
      const dataId    = body.data?.id || "";
      const manifest  = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const expected  = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(manifest).digest("hex");

      if (hash !== expected) {
        console.warn("⚠️  Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // Handle different notification types
    if (body.type === "payment" || body.action === "payment.created" || body.action === "payment.updated") {
      const paymentId = body.data?.id;

      if (paymentId) {
        // Fetch full payment details from Mercado Pago
        const paymentResponse = await axios.get(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
        );
        const payment = paymentResponse.data;

        // Map MP status to our status
        const statusMap = {
          approved:    "approved",
          pending:     "pending",
          in_process:  "in_process",
          rejected:    "rejected",
          cancelled:   "cancelled",
          refunded:    "refunded",
        };

        // Update our transaction record
        const updated = await Transaction.findOneAndUpdate(
          {
            $or: [
              { mpPaymentId: paymentId.toString() },
              { mpPreferenceId: payment.preference_id },
            ],
          },
          {
            mpPaymentId:    paymentId.toString(),
            status:         statusMap[payment.status] || payment.status,
            webhookPayload: payment,
            errorDetail:    payment.status_detail || null,
          },
          { new: true }
        );

        if (updated) {
          console.log(`✅ Transaction ${updated._id} updated to: ${updated.status}`);

          // ──────────────────────────────────────────────
          // 🔔 PUSH NOTIFICATION HOOK
          // This is where you notify MexiChat users
          // ──────────────────────────────────────────────
          if (updated.status === "approved") {
            await notifyUsers(updated, "approved");
          } else if (updated.status === "rejected") {
            await notifyUsers(updated, "rejected");
          }
        } else {
          console.warn(`⚠️  No transaction found for payment ${paymentId}`);
        }
      }
    }

    // Always respond 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
    // Still return 200 to prevent Mercado Pago from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

// ─── Notify MexiChat Users ───
async function notifyUsers(transaction, status) {
  const messages = {
    approved: `✅ Transferencia exitosa: $${transaction.amount} MXN enviados`,
    rejected: `❌ Transferencia rechazada: $${transaction.amount} MXN`,
    pending:  `⏳ Transferencia pendiente: $${transaction.amount} MXN`,
  };

  // TODO: Connect to your MexiChat notification system
  // Examples:
  //   - WebSocket emit to connected clients
  //   - Push notification via Firebase/APNs
  //   - Insert message into chat thread
  console.log(`🔔 Notify sender (${transaction.senderId}): ${messages[status]}`);
  console.log(`🔔 Notify receiver (${transaction.receiverId}): ${messages[status]}`);

  // Example: If you use Socket.IO
  // global.io.to(transaction.senderId).emit("payment_update", { transaction, status });
  // global.io.to(transaction.receiverId).emit("payment_update", { transaction, status });
}

module.exports = router;
