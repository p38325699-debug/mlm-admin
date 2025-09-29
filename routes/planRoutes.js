// backend/routes/planRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const plans = require("../utils/plans");

// Map of plans with values
// utils/plans.js
// module.exports = { Bronze: 0, Silver: 60, Gold1: 100, Gold2: 200, Premium1: 500, Premium2: 1000, Premium3: 2000, Premium4: 5000, Premium5: 10000 };

router.post("/upgrade/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPlan } = req.body;

    if (!plans[newPlan]) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    // 1. Update user plan
    await pool.query(
      "UPDATE sign_up SET business_plan = $1 WHERE id = $2",
      [newPlan, userId]
    );

    // 2. Get user's referrer
    const userRes = await pool.query(
      "SELECT full_name, under_ref FROM sign_up WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { under_ref, full_name } = userRes.rows[0];
    if (!under_ref) {
      return res.json({ success: true, message: "Plan upgraded. No referrer." });
    }

    // 3. Find referrer by reference_code
    const refRes = await pool.query(
      "SELECT id FROM sign_up WHERE reference_code = $1",
      [under_ref]
    );

    if (refRes.rows.length === 0) {
      return res.json({ success: true, message: "Plan upgraded. Referrer not found." });
    }

    const referrer = refRes.rows[0];

    // 4. Calculate commission
    const bonus = plans[newPlan] * 0.10;

    // 5. Add to referrer’s coin balance
    await pool.query(
      "UPDATE sign_up SET coin = coin + $1 WHERE id = $2",
      [bonus, referrer.id]
    );

    // 6. Insert notification
    await pool.query(
      "INSERT INTO notifications (user_id, message) VALUES ($1, $2)",
      [
        referrer.id,
        `${full_name} upgraded to ${newPlan}. You earned +${bonus} coins.`,
      ]
    );

    return res.json({
      success: true,
      message: `Plan upgraded to ${newPlan}. Referrer earned ${bonus} coins.`,
    });
  } catch (err) {
    console.error("Plan upgrade error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
