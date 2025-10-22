// routes/cryptoRoutes.js - FIXED VERSION
const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../config/db");

// ✅ Create Cryptomus Payment (USDT BEP20)
router.post("/crypto-payment", async (req, res) => {
  try {
    // const { user_id, amount, currency = "USD" } = req.body;
    const { user_id, amount, currency = "USD", network } = req.body;


    if (!user_id || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing user_id or amount or network"
      });
    }

    const allowedNetworks = [
  "POLYGON", "AVALANCHE", "SOL", "TON", 
  "TRON", "BSC", "ETH", "ARBITRUM"
];

if (!allowedNetworks.includes(network)) {
  return res.status(400).json({
    success: false,
    message: `Invalid network. Allowed: ${allowedNetworks.join(", ")}`
  });
}


    // Cryptomus credentials - CORRECT KEYS
    const merchantUuid = process.env.CRYPTOMUS_MERCHANT_ID; // Your user_key
    const apiKey = process.env.CRYPTOMUS_API_KEY; // Your payment API key (NOT payout key)

    if (!merchantUuid || !apiKey) {
      return res.status(500).json({
        success: false,
        message: "Cryptomus credentials not configured"
      });
    }

    // Generate unique order ID
    const orderId = `CRYPTO_${user_id}_${Date.now()}`;

    // ✅ CORRECT PAYLOAD FOR USDT BEP20
    const payload = {
      amount: amount.toString(),
      currency: "USD", // You pay in USD
      order_id: orderId,
      url_callback: `${process.env.API_BASE_URL}/api/crypto/crypto-callback`,
      url_return: `${process.env.CLIENT_URL}/payment-success`,
      url_success: `${process.env.CLIENT_URL}/payment-success`,
      to_currency: "USDT",
      network: network, // dynamically received from frontend
      is_payment_multiple: false,
      lifetime: 1800, // 30 minutes
      subtract: 0 // User pays network fees
    };

    console.log("🟡 Cryptomus Payload:", payload);

    // ✅ CORRECT SIGNATURE GENERATION
    const encodedData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const sign = crypto
      .createHash('md5')
      .update(encodedData + apiKey)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'merchant': merchantUuid,
      'sign': sign
    };

    console.log("🟡 Making request to Cryptomus...");

    // ✅ FASTER TIMEOUT & BETTER ERROR HANDLING
    const response = await axios.post(
      'https://api.cryptomus.com/v1/payment',
      payload,
      {
        headers,
        timeout: 20000, // 20 second timeout
        validateStatus: (status) => status < 500
      }
    );

    console.log("🟡 Cryptomus Response:", response.data);

    if (response.data.result) {
      // Store in database
      await pool.query(
        `INSERT INTO crypto_payments (user_id, amount, currency, network, order_id, payment_status, payment_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user_id, amount, 'USDT', 'BEP20', orderId, 'pending', response.data.result.url]
      );


      return res.json({
        success: true,
        payment: response.data,
        order_id: orderId,
        payment_url: response.data.result.url
      });
    } else {
      throw new Error(response.data.message || 'Cryptomus API error');
    }

  } catch (error) {
    console.error("❌ Cryptomus Payment Error:", {
      message: error.message,
      response: error.response?.data,
      code: error.code
    });

    let errorMessage = "Payment initiation failed";

    if (error.code === 'ECONNABORTED') {
      errorMessage = "Payment gateway timeout. Please try again.";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.status === 522) {
      errorMessage = "Payment service temporarily unavailable. Please try again in a few minutes.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// ✅ Webhook handler for Cryptomus
router.post("/crypto/crypto-callback", async (req, res) => {
  try {
    console.log("🟡 Cryptomus Callback Received:", req.body);

    const { order_id, status, amount, currency } = req.body;

    if (status === "paid" || status === "paid_over") {
      // Find payment record
      const paymentResult = await pool.query(
        "SELECT * FROM crypto_payments WHERE order_id = $1",
        [order_id]
      );

      if (paymentResult.rows.length > 0) {
        const payment = paymentResult.rows[0];

        // ✅ Update payment as confirmed
        await pool.query(
          `UPDATE crypto_payments 
           SET payment_status = 'confirmed', updated_at = NOW()
           WHERE order_id = $1`,
          [order_id]
        );

        // ✅ Update user balance
        await pool.query(
          "UPDATE sign_up SET coin = COALESCE(coin, 0) + $1 WHERE id = $2",
          [amount, payment.user_id]
        );

        // ✅ Create a notification entry
        const message = `Crypto payment of ${amount} ${currency} has been successfully received and added to your wallet.`;

        await pool.query(
          "INSERT INTO notifications (user_id, message) VALUES ($1, $2)",
          [payment.user_id, message]
        );

        console.log("✅ Payment confirmed & notification added:", message);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Cryptomus Callback Error:", error);
    res.status(500).json({ success: false });
  }
});

// ✅ Admin: Fetch all crypto payments with user info
router.get("/admin/all-payments", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.user_id,
        s.full_name,
        s.email,
        c.order_id,
        c.amount,
        c.currency,
        c.network,
        c.payment_status,
        c.tx_hash,
        c.payment_url,
        TO_CHAR(c.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        TO_CHAR(c.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM crypto_payments c
      JOIN sign_up s ON c.user_id = s.id
      ORDER BY c.created_at DESC;
    `);

    res.json({
      success: true,
      total: result.rows.length,
      payments: result.rows
    });
  } catch (error) {
    console.error("❌ Fetch All Payments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch crypto payments"
    });
  }
});


module.exports = router;