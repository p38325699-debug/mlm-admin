// backend/controllers/otpController.js
const pool = require("../config/db");
const nodemailer = require("nodemailer");

// Send OTP and save/update in DB
exports.sendOtp = async (req, res) => {
  const { email, userData } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const cleanEmail = email.trim().toLowerCase();
  const phone = userData.phone_number;

  try {
    // 🔍 Check if email or phone already exists
    const checkUser = await pool.query(
      `SELECT id, verified, email, phone_number 
       FROM sign_up 
       WHERE LOWER(email) = $1 OR phone_number = $2`,
      [cleanEmail, phone]
    );

    if (checkUser.rows.length > 0) {
      const existing = checkUser.rows[0];

      if (existing.verified) {
        return res
          .status(400)
          .json({ success: false, message: "Email or phone already registered & verified" });
      }

      // If exists but not verified → update record
      await pool.query(
        `UPDATE sign_up
         SET full_name = $1, dob = $2, country_code = $3, phone_number = $4, gender = $5, password = $6, otp = $7
         WHERE id = $8`,
        [
          userData.full_name,
          userData.dob,
          userData.country_code,
          userData.phone_number,
          userData.gender,
          userData.password,
          otp,
          existing.id
        ]
      );
    } else {
      // Insert as pending user
      await pool.query(
        `INSERT INTO sign_up 
           (full_name, email, dob, country_code, phone_number, gender, password, otp, verified) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
        [
          userData.full_name,
          cleanEmail,
          userData.dob,
          userData.country_code,
          userData.phone_number,
          userData.gender,
          userData.password,
          otp
        ]
      );
    }

    // Send OTP via email
    // const transporter = nodemailer.createTransport({
    //   service: "gmail",
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS
    //   }
    // });

    const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER, // Gmail address
    pass: process.env.EMAIL_PASS, // App password
  },
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
      `SELECT * FROM sign_up WHERE LOWER(email) = $1`,
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

    // ✅ Update verified status
    await pool.query(
      `UPDATE sign_up SET verified = true, otp = NULL WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    // ✅ Fetch fresh user details (without password)
    const updatedUser = await pool.query(
      `SELECT 
         id,
         full_name AS "fullName",
         email,
         reference_code AS "referenceCode",
         status
       FROM sign_up 
       WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    res.json({
      success: true,
      message: "OTP verified and account activated",
      user: updatedUser.rows[0]   // ✅ send user object back
    });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
};

