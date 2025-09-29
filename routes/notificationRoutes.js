// backend/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get notifications for a user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT message, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Notification fetch error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
