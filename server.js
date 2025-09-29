// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");
const adminRoutes = require("./routes/adminRoutes");
const homeDataRoutes = require("./routes/homeDataRoutes");
const quizRoutes = require("./routes/quizRoutes");
const userRoutes = require("./routes/userRoutes"); 
const referralRoutes = require("./routes/referralRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const coinRoutes = require("./routes/coinRoutes");
const planRoutes = require("./routes/planRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
 
// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// Log every incoming request
app.use((req, res, next) => {
  console.log(`📩 Incoming: ${req.method} ${req.url}`);
  next();
});


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", homeDataRoutes);
app.use("/api", quizRoutes);
app.use("/api/users", userRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api", coinRoutes);
app.use("/api/plan", planRoutes);
app.use("/api/notifications", notificationRoutes);


// Start server
const PORT = process.env.PORT || 5000;

// Start background jobs
require("./cronJobs/dayCountDecrement");

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend is running 🚀" });
});



