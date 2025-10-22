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
const upiRoutes = require("./routes/upiRoutes");
const walletRoutes = require("./routes/walletRoutes");
const dashboardRoutes = require("./routes/dashboard"); 
const cryptoRoutes = require("./routes/cryptoRoutes");
const contactRoutes = require("./routes/contactRoutes");

require("./cronJobs/cleanup");
require("./cronJobs/unverifyIfNoMpin");


const app = express();
  
// Middleware
// app.use(cors());

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'https://knowo.world',
      'https://www.knowo.world',
      'https://mlm-admin.onrender.com'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));


// Add this middleware in server.js after CORS setup
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isBrowser = /mozilla|chrome|safari|firefox|edge|opera/i.test(userAgent.toLowerCase());
  
  req.isBrowserRequest = isBrowser;
  next();
});

// ✅ increase payload limit to handle large images
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// app.use(express.json());
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
app.use("/api", upiRoutes);
app.use("/api", walletRoutes);
app.use("/api", cryptoRoutes);
app.use("/api", contactRoutes);
app.use("/api/dashboard", dashboardRoutes);



// Start server
const PORT = process.env.PORT || 5000;

// Start background jobs
require("./cronJobs/dayCountDecrement");
require("./cronJobs/cleanup"); 
require("./cronJobs/dailyQuizInit");
require("./cronJobs/monthlyDeduction");      
require("./cronJobs/maintenanceReminder"); 

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend is running 🚀" });
});



