// 🟩 REPLACE contents of routes/planRoutes.js WITH THIS
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const plans = require("../utils/plans");

// Helper: check same-day
const hasSameDayRequest = async (userId, plan) => {
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayEnd = new Date();
  todayEnd.setHours(23,59,59,999);

  const q = `SELECT id FROM payment_uploads WHERE user_id = $1 AND plan = $2 AND payment_date BETWEEN $3 AND $4 LIMIT 1`;

  const r = await pool.query(q, [userId, plan, todayStart.toISOString(), todayEnd.toISOString()]);
  return r.rows.length > 0 ? r.rows[0].id : null;
};

// --- existing upgrade immediate route (keeps your referrer commission flow) ---
router.post("/upgrade/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPlan } = req.body;

    if (!plans[newPlan]) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    // 1. Update user plan
    await pool.query(
      "UPDATE sign_up SET business_plan = $1, day_count = 45 WHERE id = $2",
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

// --- GET refcount + direct members’ business_plan ---
router.get("/refcount/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // find this user’s reference_code
    const self = await pool.query("SELECT reference_code FROM sign_up WHERE id = $1", [userId]);
    if (self.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const refCode = self.rows[0].reference_code;

    // all direct members
    const direct = await pool.query(
      "SELECT id, business_plan FROM sign_up WHERE under_ref = $1",
      [refCode]
    );

    res.json({
      success: true,
      reference_count: direct.rows.length,
      referrals: direct.rows, // includes each referral’s plan
    });
  } catch (err) {
    console.error("Error fetching reference details:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// --- VALIDATE eligibility (business_plan + count) ---
router.post("/validate", async (req, res) => {
  try {
    const { userId, newPlan } = req.body;
    if (!userId || !newPlan)
      return res.status(400).json({ success: false, message: "Missing params" });

    // find reference_code
    const self = await pool.query("SELECT reference_code FROM sign_up WHERE id = $1", [userId]);
    if (self.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const refCode = self.rows[0].reference_code;

    // get all direct members
    const direct = await pool.query(
      "SELECT business_plan FROM sign_up WHERE under_ref = $1",
      [refCode]
    );

    const total = direct.rows.length;
    const plans = direct.rows.map((r) => r.business_plan);

    // required plan type & count
    const rules = {
      "Gold 1": { need: "Silver", min: 5 },
      "Gold 2": { need: "Silver", min: 10 },
      "Premium 1": { need: "Gold 1", min: 25 },
      "Premium 2": { need: "Gold 1", min: 50 },
      "Premium 3": { need: "Gold 1", min: 100 },
      "Premium 4": { need: "Gold 1", min: 200 },
      "Premium 5": { need: "Gold 1", min: 500 },
    };

    // Silver plan → always allowed
    if (newPlan === "Silver")
      return res.json({ success: true, eligible: true });

    const rule = rules[newPlan];
    if (!rule)
      return res.status(400).json({ success: false, message: "Invalid plan" });

    // count how many direct members match the required plan
    const matching = plans.filter((p) =>
      p.toLowerCase().replace(/\s+/g, "") === rule.need.toLowerCase().replace(/\s+/g, "")
    ).length;

    if (matching >= rule.min) {
      return res.json({ success: true, eligible: true });
    }

    return res.status(400).json({
      success: false,
      eligible: false,
      message: `You need at least ${rule.min} direct members with '${rule.need}' plan (you have ${matching}).`,
    });
  } catch (err) {
    console.error("Validate error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user plan info
    const user = await pool.query(
      "SELECT business_plan, day_count FROM sign_up WHERE id = $1",
      [userId]
    );
    if (user.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const { business_plan, day_count } = user.rows[0];

    // ✅ Get user's latest payment
    const payRes = await pool.query(
      `SELECT plan, payment_date
       FROM payment_uploads
       WHERE user_id = $1
       ORDER BY payment_date DESC`,
      [userId]
    );

    const lastPayment = payRes.rows[0] || null;

    // Prepare response
    res.json({
      success: true,
      activePlan: business_plan,
      day_count,
      lastPayment,
    });
  } catch (err) {
    console.error("❌ /plan/status error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




// --- GET day_count for current plan ---
router.get("/daycount/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const r = await pool.query("SELECT day_count, business_plan FROM sign_up WHERE id = $1", [userId]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, day_count: r.rows[0].day_count ?? 0, business_plan: r.rows[0].business_plan });
  } catch (err) {
    console.error("Daycount error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Check same-day request exists ---
router.get("/check-request/:userId/:plan", async (req, res) => {
  try {
    const { userId, plan } = req.params;
    const existsId = await hasSameDayRequest(userId, plan);
    return res.json({ success: true, exists: !!existsId, request_id: existsId || null });
  } catch (err) {
    console.error("check-request error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Cancel / delete a request by id ---
router.delete("/request/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM payment_uploads WHERE id = $1", [id]);
    return res.json({ success: true, message: "Request removed" });
  } catch (err) {
    console.error("delete request error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- WALLET UPGRADE WITH PERMISSION ---
router.post("/upgrade", async (req, res) => {
  try {
    const { userId, newPlan, amount, confirm } = req.body;

    if (!userId || !newPlan || !amount)
      return res.status(400).json({ success: false, message: "All fields are required" });

    // 🟨 Step 1: Ask for confirmation
    if (!confirm) {
      return res.status(200).json({
        success: false,
        askPermission: true,
        message: "Need permission to proceed with wallet deduction",
      });
    }

    // 🟩 Step 2: Fetch user info
    const userRes = await pool.query(
      "SELECT coin, business_plan, under_ref, full_name, first_plan_date FROM sign_up WHERE id = $1",
      [userId]
    );
    if (userRes.rowCount === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const { coin, business_plan: prevPlan, under_ref, full_name, first_plan_date } = userRes.rows[0];

    // 🟩 Step 3: Check if this is first plan purchase
    const isFirstPlanPurchase = (prevPlan === 'Bronze' && !first_plan_date);
    
    // 🟩 Step 4: Calculate total deduction amount
    const totalDeductionAmount = isFirstPlanPurchase ? 
      amount + 6 : // Plan amount + $6 app cost
      amount;      // Only plan amount

    // 🟥 Step 5: Check balance with TOTAL amount (including $6 if first purchase)
    if (coin < totalDeductionAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient wallet balance. Need $${totalDeductionAmount} but have $${coin}.` 
      });
    }

    // 🟩 Step 6: Deduct TOTAL amount + upgrade plan
    const newBalance = coin - totalDeductionAmount;
    
    if (isFirstPlanPurchase) {
      // ✅ First time plan purchase - set first_plan_date and deduct plan + $6
      await pool.query(
        "UPDATE sign_up SET coin = $1, business_plan = $2, day_count = 45, first_plan_date = NOW() WHERE id = $3",
        [newBalance, newPlan, userId]
      );
    } else {
      // ✅ Regular upgrade - only deduct plan amount
      await pool.query(
        "UPDATE sign_up SET coin = $1, business_plan = $2, day_count = 45 WHERE id = $3",
        [newBalance, newPlan, userId]
      );
    }

    // 🟩 Step 7: Insert payment record with ACTUAL deducted amount
    await pool.query(
      `INSERT INTO payment_uploads (user_id, plan, amount) VALUES ($1, $2, $3)`,
      [userId, newPlan, totalDeductionAmount] // Store the actual deducted amount
    );

    // 🟩 Step 8: Add notification for user
    const userMsg = isFirstPlanPurchase ?
      `Your plan upgraded from ${prevPlan} to ${newPlan}. $6 app cost included.` :
      `Your plan upgraded from ${prevPlan} to ${newPlan}.`;
    
    await pool.query(`INSERT INTO notifications (user_id, message) VALUES ($1, $2)`, [
      userId,
      userMsg,
    ]);

    // 🟩 Step 9: Notify referrer if exists
    if (under_ref) {
      const refRes = await pool.query(
        "SELECT id FROM sign_up WHERE reference_code = $1",
        [under_ref]
      );
      if (refRes.rowCount > 0) {
        const refId = refRes.rows[0].id;
        const refMsg = `${full_name} upgraded from ${prevPlan} to ${newPlan}.`;
        await pool.query(`INSERT INTO notifications (user_id, message) VALUES ($1, $2)`, [
          refId,
          refMsg,
        ]);
      }
    }

    res.json({
      success: true,
      message: isFirstPlanPurchase ?
        `Plan upgraded to ${newPlan}. Wallet deducted $${totalDeductionAmount} (plan + $6 app cost).` :
        `Plan upgraded to ${newPlan}. Wallet deducted $${totalDeductionAmount}.`,
      isFirstPlanPurchase: isFirstPlanPurchase,
      deductedAmount: totalDeductionAmount // Send back actual deducted amount
    });
  } catch (err) {
    console.error("💥 Plan upgrade error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- ADMIN: Update Due Status ---
router.put("/update-due/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { due } = req.body; // expects true/false

    // ✅ Step 1: Update due status in payment_uploads
    await pool.query("UPDATE payment_uploads SET due = $1 WHERE id = $2", [due, id]);

    // ✅ Step 2: Fetch user info for this payment
    const payRes = await pool.query(
      "SELECT user_id, plan FROM payment_uploads WHERE id = $1",
      [id]
    );
    if (payRes.rows.length === 0)
      return res.status(404).json({ success: false, message: "Payment not found" });

    const { user_id, plan } = payRes.rows[0];

    // ✅ Step 3: Get user email (for response & updates)
    const userRes = await pool.query("SELECT email FROM sign_up WHERE id = $1", [user_id]);
    if (userRes.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const email = userRes.rows[0].email;

    // ✅ Step 4: If approved (due = true), update user's plan & day_count
    if (due === true) {
      await pool.query(
        "UPDATE sign_up SET business_plan = $1, day_count = 45 WHERE id = $2",
        [plan, user_id]
      );
    }

    res.json({
      success: true,
      message: `Due status updated${due ? " and plan activated" : ""} successfully`,
      email,
      plan,
    });
  } catch (err) {
    console.error("Error updating due:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/all-payments", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.user_id,
        s.full_name,
        s.email,               -- ✅ added
        p.plan,
        p.amount,
        
        p.payment_date

      FROM payment_uploads p
      JOIN sign_up s ON p.user_id = s.id
      ORDER BY p.payment_date DESC
    `);

    const data = result.rows.map((r) => ({
      ...r,
      screenshot: r.screenshot
        ? `data:image/jpeg;base64,${r.screenshot}`
        : null,
    }));

    res.json(data);
  } catch (err) {
    console.error("Error fetching payment uploads:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
