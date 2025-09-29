const cron = require("node-cron");
const pool = require("../config/db");

// Run every day at midnight server time
cron.schedule("0 0 * * *", async () => {
  try {
    const query = `
      UPDATE sign_up
      SET day_count = GREATEST(day_count - 1, 0)
      WHERE business_plan <> 'Bronze' AND day_count > 0
    `;
    await pool.query(query);
    console.log("✅ day_count decremented for all premium users");
  } catch (err) {
    console.error("❌ Error decrementing day_count:", err.message);
  }
});
