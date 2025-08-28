// Path: backend/controllers/authController.js
const pool = require("../config/db");

exports.loginUser = async (req, res) => {
  console.log("Login request received:", req.body);
  const { email } = req.body;

  if (!email || email.trim() === "") {
    return res.status(400).json({ success: false, message: "Please provide email" });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

//    const result = await pool.query(
//   `SELECT id, email, verified, status, pause_start, full_name, reference_code 
//    FROM sign_up 
//    WHERE LOWER(email) = $1`,
//   [cleanEmail]
// );

const result = await pool.query(
  `SELECT 
     id,
     email,
     verified,
     status AS "status",
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

    if (!user.verified) {
      return res.status(400).json({ success: false, message: "Email is not verified yet" });
    }

    // Block check
    if (user.status === "Block") {
      return res.status(403).json({ success: false, message: "Your account has been blocked by admin." });
    }

    // Pause check
    if (user.status === "Pause") {
      const now = new Date();
      const pauseStart = user.pause_start ? new Date(user.pause_start) : null;

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
            `UPDATE sign_up SET status = 'all ok', pause_start = NULL WHERE id = $1`,
            [user.id]
          );
        }
      }
    }

  // backend/controllers/authController.js
// res.json({
//   success: true,
//   message: "Login successful",
// user: {
//   id: user.id,
//   fullName: user.full_name,
//   referenceCode: user.reference_code,
//   email: user.email,
//   status: user.status   // ✅ Added here
// }
// });

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
