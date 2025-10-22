const pool = require("../config/db");
const cron = require("node-cron");

cron.schedule("59 23 30 * *", async () => {
  console.log("💰 Running monthly deduction job (30th 11:59 PM UTC)...");

  try {
    const users = await pool.query("SELECT id, coin FROM sign_up");

    for (const user of users.rows) {
      const newCoin = user.coin - 6;
      const plan = newCoin < 0 ? "Bronze" : null;

      // Update user coin and plan
      await pool.query(
        "UPDATE sign_up SET coin = $1, business_plan = COALESCE($2, business_plan) WHERE id = $3",
        [newCoin, plan, user.id]
      );

      // Insert notification
      await pool.query(
        "INSERT INTO notifications (user_id, message, created_at) VALUES ($1, $2, NOW())",
        [
          user.id,
          `💸 $6 has been deducted for monthly account maintenance. Your new balance: $${newCoin}.`
        ]
      );
    }

    console.log("✅ Monthly maintenance deductions complete.");
  } catch (error) {
    console.error("❌ Error running monthly deduction job:", error.message);
  }
}, { timezone: "UTC" });
