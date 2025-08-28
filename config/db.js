const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost", 
  database: "mlm_crypto",
  password: "aditi@500",
  port: 5432,
});


pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ DB Connection Error:", err));

module.exports = pool;
