require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");
const adminRoutes = require("./routes/adminRoutes");
const homeDataRoutes = require("./routes/homeDataRoutes");
const quizRoutes = require("./routes/quizRoutes");
const videoRoutes = require("./routes/videoRoutes");
const userRoutes = require("./routes/userRoutes"); // ✅ add this
// const referralRoutes = require("./routes/referralRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", homeDataRoutes);
app.use("/api", quizRoutes);
app.use("/api", videoRoutes);
app.use("/api/users", userRoutes); // ✅ mount user routes
// app.use("/api/users/referral", referralRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
