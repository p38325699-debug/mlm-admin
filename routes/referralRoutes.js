// backend/routes/referralRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");



/* ------------------ Apply Referral Code ------------------ */
router.post("/apply", async (req, res) => {
  try {
    const { userId, referralCode } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    const refUser = await pool.query(
      "SELECT id, reference_code FROM sign_up WHERE reference_code = $1",
      [referralCode]
    );

    if (refUser.rows.length === 0) {
      return res.status(400).json({ success: false, message: "reference_code not valid" });
    }
    const parent = refUser.rows[0];

    const user = await pool.query(
      "SELECT id, reference_code, under_ref FROM sign_up WHERE id = $1",
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: `User with id ${userId} not found` });
    }

    const currentUser = user.rows[0];

    if (currentUser.reference_code === referralCode) {
      return res.status(400).json({ success: false, message: "own reference_code not valid" });
    }

    if (currentUser.under_ref) {
      return res.status(400).json({ success: false, message: "Referral code already applied" });
    }

    await pool.query("UPDATE sign_up SET under_ref = $1 WHERE id = $2", [
      referralCode,
      userId,
    ]);

    await pool.query("UPDATE sign_up SET reference_count = reference_count + 1 WHERE id = $1", [
      parent.id,
    ]);

    return res.json({ success: true, message: "Referral applied successfully" });
  } catch (err) {
    console.error("Referral apply error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ------------------ Get Referrer ------------------ */
router.get("/referrer/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const userRes = await pool.query(
      "SELECT under_ref FROM sign_up WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const underRef = userRes.rows[0].under_ref;
    if (!underRef) {
      return res.json({ success: true, referrer: null });
    }

    const referrerRes = await pool.query(
      "SELECT full_name, business_plan, reference_count, reference_code FROM sign_up WHERE reference_code = $1",
      [underRef]
    );

    if (referrerRes.rows.length === 0) {
      return res.json({ success: true, referrer: null });
    }

    return res.json({ success: true, referrer: referrerRes.rows[0] });
  } catch (err) {
    console.error("Referrer fetch error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
 
/* ------------------ Get Complete Downline Tree ------------------ */
router.get("/tree/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const referrals = await pool.query(
      `
      WITH RECURSIVE downline AS (
        -- Root (the current user)
        SELECT 
          s.id, 
          s.full_name, 
          s.business_plan, 
          s.reference_count, 
          s.reference_code,
          s.under_ref,
          0 AS level
        FROM sign_up s
        WHERE s.id = $1

        UNION ALL

        -- Children
        SELECT 
          child.id, 
          child.full_name, 
          child.business_plan, 
          child.reference_count, 
          child.reference_code,
          child.under_ref,
          d.level + 1
        FROM sign_up child
        INNER JOIN downline d ON child.under_ref = d.reference_code
        WHERE d.level < 10
      )
      SELECT * FROM downline ORDER BY level, id;
      `,
      [userId]
    );

    res.json({ success: true, data: referrals.rows });
  } catch (err) {
    console.error("❌ Referral tree error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


module.exports = router;
