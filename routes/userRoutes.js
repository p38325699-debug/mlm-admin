// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ✅ Get all users (include vip, coin, business, status)
router.get("/all-users", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, dob, country_code, phone_number, gender,
             verified, vip, coin, business_plan, reference_code, created_at,
             status, pause_start
       FROM sign_up 
       ORDER BY id ASC`
    );
    res.json({ success: true, users: result.rows });

  // try {
  //   const result = await pool.query(
  //     `SELECT id, full_name, email, dob, country_code, phone_number, gender,
  //             verified, vip, coin AS wallet, business, reference_code, created_at,
  //             status, pause_start
  //      FROM sign_up 
  //      ORDER BY id ASC`
  //   );
  //   res.json(result.rows); 
  // } catch (error) {
  //   console.error("Error fetching users:", error);
  //   res.status(500).json({ success: false, message: "Server error" });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ Get single user profile
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, full_name, email, phone_number, dob, reference_code, gender, country_code,
              verified, created_at, status, vip, coin, business_plan
       FROM sign_up 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ Get user by ID
router.get("/:id", async (req, res) => {
  const userId = req.params.id;

  try {
   // ✅ Correct: look into your "sign_up" table
const result = await pool.query(
  `SELECT id, full_name, email, phone_number, dob, reference_code, gender, country_code,
          verified, created_at, status, vip, coin, business_plan
   FROM sign_up 
   WHERE id = $1`,
  [userId]
);

if (result.rows.length === 0) {
  return res.json({ success: false, message: "User not found" });
}

const user = result.rows[0];
res.json({ success: true, user });

  } catch (err) {
    console.error("❌ DB error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Update user status (with pause_start tracking)
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required" });
  }

  try {
    let query, values;

   if (status === "pause") {
  query = "UPDATE sign_up SET status = $1, pause_start = NOW() WHERE id = $2 RETURNING *";
  values = [status, id];
} else if (status === "active") {
  query = "UPDATE sign_up SET status = $1, pause_start = NULL WHERE id = $2 RETURNING *";
  values = [status, id];
} else {
  query = "UPDATE sign_up SET status = $1 WHERE id = $2 RETURNING *";
  values = [status, id];
}


    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Status updated successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ Get referral details
router.get("/referral/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT full_name, reference_code FROM sign_up WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, referral: result.rows[0] });
  } catch (error) {
    console.error("Error fetching referral code:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
