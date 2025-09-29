// backend/controllers/authController.js
const pool = require("../config/db");

exports.loginUser = async (req, res) => {
  console.log("Login request received:", req.body);
  const { email, password } = req.body;

  if (!email || !password || email.trim() === "" || password.trim() === "") {
    return res.status(400).json({ success: false, message: "Please provide email and password" });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT 
         id,
         email,
         password,
         verified,
         status,
         pause_start AS "pauseStart",
         full_name AS "fullName",
         reference_code AS "referenceCode"
       FROM sign_up 
       WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ success: false, message: "Email is not registered yet" });
    }

    const user = result.rows[0];

    // ✅ Password check (plain for now; replace with bcrypt.compare if hashed)
    if (user.password !== password.trim()) {
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    // ✅ Verified check
    if (!user.verified) {
      return res.status(400).json({ success: false, message: "Email is not verified yet" });
    }

    // ✅ Block check
    if (user.status === "block") {
      return res.status(403).json({ success: false, message: "Your account has been blocked by admin." });
    }

    // ✅ Pause check
    if (user.status === "pause") {
      const now = new Date();
      const pauseStart = user.pauseStart ? new Date(user.pauseStart) : null;

      if (pauseStart) {
        const pauseDuration = now - pauseStart;
        const daysPaused = Math.floor(pauseDuration / (1000 * 60 * 60 * 24));

        if (daysPaused < 30) {
          const daysLeft = 30 - daysPaused;
          return res.status(403).json({
            success: false,
            message: `Your account is paused. Try again in ${daysLeft} days.`
          });
        } else {
          // Auto-reactivate
          await pool.query(
            `UPDATE sign_up SET status = 'ok', pause_start = NULL WHERE id = $1`,
            [user.id]
          );
          user.status = "ok";
          user.pauseStart = null;
        }
      }
    }

    // Don’t send back password in response
    delete user.password;

    res.json({
      success: true,
      message: "Login successful",
      user
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
