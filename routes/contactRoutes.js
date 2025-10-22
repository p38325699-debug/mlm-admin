const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// POST /api/contact
router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    await pool.query(
      "INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)",
      [name, email, message]
    );

    res.status(200).json({ success: true, message: "Message stored successfully!" });
  } catch (err) {
    console.error("❌ Error saving message:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
