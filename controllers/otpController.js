const pool = require("../config/db");
const nodemailer = require("nodemailer");

// Send OTP and save/update in DB
exports.sendOtp = async (req, res) => {
  const { email, userData } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const cleanEmail = email.trim().toLowerCase();

  try {
    const checkUser = await pool.query(
      `SELECT id, verified FROM sign_up WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (checkUser.rows.length > 0) {
      if (checkUser.rows[0].verified) {
        return res.status(400).json({ success: false, message: "Email already registered" });
      }

      // If exists but not verified → update OTP & details
      await pool.query(
        `UPDATE sign_up
         SET full_name = $1, dob = $2, country_code = $3, phone_number = $4, gender = $5, otp = $6
         WHERE LOWER(email) = $7`,
        [
          userData.full_name,
          userData.dob,
          userData.country_code,
          userData.phone_number,
          userData.gender,
          otp,
          cleanEmail
        ]
      );
    } else {
      // Insert as pending user
      await pool.query(
        `INSERT INTO sign_up (full_name, email, dob, country_code, phone_number, gender, otp, verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
        [
          userData.full_name,
          cleanEmail,
          userData.dob,
          userData.country_code,
          userData.phone_number,
          userData.gender,
          otp
        ]
      );
    }

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}`
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

// Verify OTP and mark user as verified
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const cleanEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      `SELECT otp, verified FROM sign_up WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Email not found" });
    }

    const user = result.rows[0];

    if (user.verified) {
      return res.status(400).json({ success: false, message: "Already verified" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    await pool.query(
      `UPDATE sign_up SET verified = true, otp = NULL WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    res.json({ success: true, message: "OTP verified and account activated" });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
};
