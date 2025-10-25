const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // ✅ Update if needed

// ✅ SET MPIN
router.post("/set-mpin", async (req, res) => {
  const { email, mpin } = req.body;

  if (!email || !mpin) {
    return res.status(400).json({ success: false, message: "Email & MPIN required" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE sign_up SET mpin = ? WHERE email = ?",
      [mpin, email]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "MPIN set successfully" });
  } catch (err) {
    console.error("Set MPIN Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// ✅ VERIFY MPIN
router.post("/verify-mpin", async (req, res) => {
  const { email, mpin } = req.body;

  if (!email || !mpin) {
    return res.status(400).json({ success: false, message: "Email & MPIN required" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id FROM sign_up WHERE email = ? AND mpin = ?",
      [email, mpin]
    );

    if (rows.length > 0) {
      return res.json({
        success: true,
        message: "MPIN verified",
        user_id: rows[0].id,
      });
    } else {
      return res.json({
        success: false,
        message: "Invalid MPIN"
      });
    }
  } catch (err) {
    console.error("Verify MPIN Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
