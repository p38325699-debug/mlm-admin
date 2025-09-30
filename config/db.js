// config/db.js
const { Pool } = require("pg");
require("dotenv").config();

console.log("🔑 RESEND_API_KEY:", process.env.RESEND_API_KEY ? "Loaded ✅" : "Missing ❌");
// console.log("📧 EMAIL_FROM:", process.env.EMAIL_FROM); // Remove or comment this line


const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ DB Connection Error:", err));

module.exports = pool;
