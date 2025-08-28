// backend/routes/referralRoutes.js
const express = require("express");
const router = express.Router();
const { getReferralCode } = require("../controllers/referralController");

// GET /api/users/referral/:id
router.get("/:id", getReferralCode);

module.exports = router;
