require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const oauthRoutes   = require("./routes/oauth");
const paymentRoutes = require("./routes/payments");
const webhookRoutes = require("./routes/webhooks");

const app = express();

// --- Security & Middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(morgan("dev"));

// Parse JSON for all routes EXCEPT webhooks (needs raw body for signature verification)
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api/", limiter);

// --- Routes ---
app.use("/api/oauth",    oauthRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "mexichat-pagos", timestamp: new Date().toISOString() });
});

// --- Database & Start ---
const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Pagos backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
