// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { loginUser } = require("../controllers/authController");
const { sendOtp } = require("../controllers/otpController");

// Registration route (OTP)
router.post("/register", sendOtp);

// Login route
router.post("/login", loginUser);

module.exports = router;
