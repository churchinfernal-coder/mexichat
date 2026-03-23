const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middleware/auth");
const MercadoPagoService = require("../services/mercadopagoService");
const Transaction = require("../models/Transaction");
const UserMPAuth = require("../models/UserMPAuth");

// ─── Send Money (Create Transfer) ───
// POST /api/payments/send
router.post("/send", authenticateUser, async (req, res) => {
  try {
    const { receiverId, receiverEmail, amount, description } = req.body;
    const senderId = req.user.userId;

    // Validation
    if (!receiverId || !receiverEmail || !amount) {
      return res.status(400).json({ error: "receiverId, receiverEmail, y amount son requeridos" });
    }
    if (amount < 1) {
      return res.status(400).json({ error: "El monto mínimo es $1 MXN" });
    }
    if (senderId === receiverId) {
      return res.status(400).json({ error: "No puedes enviarte dinero a ti mismo" });
    }

    // Get sender's MP token
    const senderToken = await MercadoPagoService.getValidToken(senderId);

    // Get receiver's MP info
    const receiverAuth = await UserMPAuth.findOne({ userId: receiverId, isActive: true });
    if (!receiverAuth) {
      return res.status(400).json({ error: "El destinatario no tiene cuenta Mercado Pago vinculada" });
    }

    // Create transaction record FIRST (pending)
    const transaction = await Transaction.create({
      senderId,
      receiverId,
      amount,
      currency:      "MXN",
      description:   description || `Pago de MexiChat`,
      senderEmail:   req.user.email,
      receiverEmail,
      status:        "pending",
    });

    // Create checkout preference (Mercado Pago handles the actual payment)
    const preference = await MercadoPagoService.createPreference({
      senderAccessToken: senderToken,
      receiverMPUserId:  receiverAuth.mpUserId,
      amount,
      description: description || `Pago de MexiChat`,
      senderEmail: req.user.email,
      receiverEmail,
    });

    // Update transaction with MP reference
    transaction.mpPreferenceId = preference.id;
    await transaction.save();

    res.json({
      success:        true,
      transactionId:  transaction._id,
      checkoutUrl:    preference.init_point,      // Full Mercado Pago checkout
      sandboxUrl:     preference.sandbox_init_point, // For testing
      preferenceId:   preference.id,
    });
  } catch (error) {
    console.error("❌ Payment error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Error al procesar el pago",
      detail: error.response?.data?.message || error.message,
    });
  }
});

// ─── Get Transaction History ───
// GET /api/payments/history?page=1&limit=20
router.get("/history", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page   = parseInt(req.query.page) || 1;
    const limit  = Math.min(parseInt(req.query.limit) || 20, 50);

    const transactions = await Transaction.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// ─── Get Single Transaction ───
// GET /api/payments/:id
router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).lean();
    if (!transaction) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }

    // Only sender or receiver can view
    if (transaction.senderId !== req.user.userId && transaction.receiverId !== req.user.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener transacción" });
  }
});

module.exports = router;
