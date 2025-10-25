// routes/cryptoRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../config/db");

// ✅ Create Cryptomus Payment
router.post("/crypto-payment", async (req, res) => {
  try {
    const { user_id, amount, currency = "USD" } = req.body;

    if (!user_id || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing user_id or amount",
      });
    }

    // ⚙️ Hardcoded credentials (use env vars in production)
    const MERCHANT_ID = "b0d59e47-6d75-41ec-bffb-d241727373c1";
    const API_KEY =
      "ytlMOpHfCUVtRyHuCyqZ7bCCFUa0TZoa1B0DoaWvq1hPyK4me2dmyrScGuO4gCLlJQWtkXRSABxv4yhaa8sO3piRxfjx1hRhYc186D62GIMb6WNo42H7WJklTEN8vHjP";

    // 🆔 Unique order ID
    const orderId = `CRYPTO_${user_id}_${Date.now()}`;

    // ✅ Prepare payload
    const payload = {
      amount: amount.toString(),
      currency,
      order_id: orderId,
      to_currency: "USDT",
      lifetime: 1800,
      url_callback: `${process.env.API_BASE_URL}/api/crypto/crypto-callback`,
      url_return: `${process.env.CLIENT_URL}/payment-success`,
      url_success: `${process.env.CLIENT_URL}/payment-success`,
    };

    console.log("🟡 Sending Payload:", payload);

    // ✅ Encode + sign (for header only)
    const base64data = Buffer.from(JSON.stringify(payload)).toString("base64");
    const sign = crypto
      .createHash("md5")
      .update(base64data + API_KEY)
      .digest("hex");

    console.log("🟢 Generated Signature:", sign);

    const headers = {
      merchant: MERCHANT_ID,
      sign,
      "Content-Type": "application/json",
    };

    // ✅ Send request to Cryptomus API (IMPORTANT: send payload, not base64)
    const response = await axios.post(
      "https://api.cryptomus.com/v1/payment",
      payload, // ✅ Correct body
      { headers }
    );

    console.log("✅ Cryptomus API Response:", response.data);

    // ✅ Save to DB and return success
    if (response.data?.result?.url) {
      await pool.query(
        `INSERT INTO crypto_payments 
         (user_id, amount, currency, order_id, payment_status, payment_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user_id, amount, currency, orderId, "pending", response.data.result.url]
      );

      return res.json({
        success: true,
        payment_url: response.data.result.url,
        order_id: orderId,
      });
    } else {
      console.log("⚠️ Cryptomus returned unexpected data:", response.data);
      return res.status(500).json({
        success: false,
        message: response.data.message || "Payment initiation failed",
      });
    }
  } catch (error) {
    console.error("❌ Cryptomus Error Details:");
    if (error.response) {
      console.error("🔴 Status:", error.response.status);
      console.error("🔴 Data:", error.response.data);
    } else {
      console.error(error);
    }

    res.status(500).json({
      success: false,
      message:
        error.response?.data?.message ||
        "Payment initiation failed (check server logs)",
    });
  }
});

// ✅ Cryptomus Webhook (unchanged)
router.post("/crypto/crypto-callback", async (req, res) => {
  try {
    console.log("🟡 Cryptomus Callback Received:", req.body);

    const { order_id, status, amount, currency } = req.body;

    if (status === "paid" || status === "paid_over") {
      const result = await pool.query(
        "SELECT * FROM crypto_payments WHERE order_id = $1",
        [order_id]
      );

      if (result.rows.length > 0) {
        const payment = result.rows[0];

        await pool.query(
          `UPDATE crypto_payments 
           SET payment_status = 'confirmed', updated_at = NOW()
           WHERE order_id = $1`,
          [order_id]
        );

        await pool.query(
          "UPDATE sign_up SET coin = COALESCE(coin, 0) + $1 WHERE id = $2",
          [amount, payment.user_id]
        );

        const message = `Crypto payment of ${amount} ${currency} confirmed and added to your wallet.`;
        await pool.query(
          "INSERT INTO notifications (user_id, message) VALUES ($1, $2)",
          [payment.user_id, message]
        );

        console.log("✅ Payment confirmed for order:", order_id);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Cryptomus Callback Error:", error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
