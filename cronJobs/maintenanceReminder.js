const pool = require("../config/db");
const cron = require("node-cron");

cron.schedule("0 12 25-29 * *", async () => {
  console.log("🔔 Sending maintenance reminder (25th–29th)...");

  const monthName = new Date().toLocaleString("en-US", { month: "long" });
  const message = `⚠️ On 30th ${monthName}, $6 will be deducted for account maintenance. Please ensure your wallet has enough balance.`;

  try {
    const users = await pool.query("SELECT id FROM sign_up");

    for (const user of users.rows) {
      await pool.query(
        "INSERT INTO notifications (user_id, message, created_at) VALUES ($1, $2, NOW())",
        [user.id, message]
      );
    }

    console.log("✅ Maintenance reminder notifications sent.");
  } catch (error) {
    console.error("❌ Error sending maintenance reminders:", error.message);
  }
}, { timezone: "UTC" });
