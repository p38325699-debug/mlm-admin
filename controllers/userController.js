// controllers/userController.js
const pool = require("../config/db");
exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Get current user
    const result = await pool.query(
      `SELECT 
         id, 
         full_name, 
         email, 
         phone_number, 
         dob, 
         reference_code, 
         gender, 
         country_code, 
         verified, 
         created_at, 
         status, 
         coin, 
         TRIM(business_plan) AS business_plan, 
         COALESCE(day_count, 0) AS day_count,
         under_ref,
         pause_start,
         block_date,
         reference_count
       FROM sign_up 
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    // ✅ Debug log
    console.log("🔎 User:", user.id, "under_ref:", user.under_ref);

    // 2️⃣ Check if under_ref exists
    if (!user.under_ref) {
      return res.json({
        success: true,
        user,
        hasReferrer: false,
        referrer: null,
      });
    }

    // 3️⃣ If under_ref → fetch referrer
    const refRes = await pool.query(
      `SELECT 
         full_name, 
         TRIM(business_plan) AS business_plan, 
         reference_count,
         reference_code
       FROM sign_up 
       WHERE reference_code = $1`,
      [user.under_ref]
    );

    const referrer = refRes.rows.length > 0 ? refRes.rows[0] : null;

    return res.json({
      success: true,
      user,
      hasReferrer: !!referrer,
      referrer,
    });
  } catch (err) {
    console.error("❌ Get user details error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
