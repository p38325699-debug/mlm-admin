// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
// const nodemailer = require("nodemailer");
const { Resend } = require("resend"); // ✅ ADD THIS LINE
const resend = new Resend(process.env.RESEND_API_KEY);
const { getUserDetails } = require("../controllers/userController");

// ✅ Test route
router.get("/", (req, res) => {
  res.json({ success: true, message: "User routes are working 🚀" });
});


// ✅ Get all users
router.get("/all-users", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM sign_up ORDER BY id ASC`
    );
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ Get single user profile
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, full_name, email, phone_number, dob, reference_code, gender, country_code,
          verified, created_at, status, coin, business_plan, under_ref
   FROM sign_up 
   WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("❌ Error fetching user profile:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Update trust column
router.put("/:id/trust", async (req, res) => {
  const { id } = req.params;
  const { trust } = req.body; // true / false

  if (typeof trust !== "boolean") {
    return res.status(400).json({ success: false, message: "Invalid trust value" });
  }

  try {
    const result = await pool.query(
      "UPDATE sign_up SET trust = $1 WHERE id = $2 RETURNING *",
      [trust, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: `Trust updated to ${trust}`,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating trust:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ Update payment status
router.put("/:id/payment-status", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE sign_up SET payment_status = TRUE WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Payment approved successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ Get user by ID (alternative simple endpoint)
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM sign_up WHERE id=$1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Error fetching user" });
  }
});

// ✅ Update user status (pause / active / block)
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required" });
  }

  try {
    let query, values;

   if (status === "pause") {
  query = "UPDATE sign_up SET status = $1, pause_start = NOW() WHERE id = $2 RETURNING *";
  values = [status, id];
} else if (status === "active") {
  query = "UPDATE sign_up SET status = $1 WHERE id = $2 RETURNING *";
  values = [status, id];
} else if (status === "block") {
  query = "UPDATE sign_up SET status = $1, block_date = NOW() WHERE id = $2 RETURNING *";
  values = [status, id];
} else {
  query = "UPDATE sign_up SET status = $1 WHERE id = $2 RETURNING *";
  values = [status, id];
}

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Status updated successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Update user profile (only update fields that are sent)
router.put("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    // Build SET clause dynamically
    const setClauses = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {  // only include fields that are sent
        setClauses.push(`${key} = $${i}`);
        values.push(value);
        i++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided for update" });
    }

    values.push(id); // last value is for WHERE clause

    const query = `UPDATE sign_up SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Profile updated successfully", user: result.rows[0] });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Add new user
router.post("/add-user", async (req, res) => {
  try {
    const { full_name, email, phone_number, dob, gender, country_code, business_plan, reference_code } = req.body;

    const result = await pool.query(
      `INSERT INTO sign_up (full_name, email, phone_number, dob, gender, country_code, business_plan, reference_code, created_at) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [full_name, email, phone_number, dob, gender, country_code, business_plan, reference_code]
    );

    res.json({ success: true, message: "User added successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Error inserting user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Get referral details
router.get("/referral/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT full_name, reference_code FROM sign_up WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, referral: result.rows[0] });
  } catch (error) {
    console.error("Error fetching referral code:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Apply referral code
router.post("/apply-referral/:id", async (req, res) => {
  try {
    const { id } = req.params; // user applying the referral
    const { referralCode } = req.body;

    // Get current user
    const userRes = await pool.query("SELECT reference_code, under_ref FROM sign_up WHERE id=$1", [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    
    const user = userRes.rows[0];
    if (user.under_ref) {
      return res.status(400).json({ success: false, message: "Referral code already applied" });
    }
    if (user.reference_code === referralCode) {
      return res.status(400).json({ success: false, message: "Own reference_code not allowed" });
    }

    // Check if referral code exists
    const refUserRes = await pool.query("SELECT id FROM sign_up WHERE reference_code=$1", [referralCode]);
    if (refUserRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid referral code" });
    }

    const refUserId = refUserRes.rows[0].id;

    // Save under_ref + increment referral_count
    await pool.query("UPDATE sign_up SET under_ref=$1 WHERE id=$2", [referralCode, id]);
    await pool.query("UPDATE sign_up SET reference_count = reference_count + 1 WHERE id=$1", [refUserId]);

    res.json({ success: true, message: "Referral applied successfully" });
  } catch (error) {
    console.error("Error applying referral:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Check if a user already has under_ref
router.get("/:id/check-ref", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT id, full_name, under_ref FROM sign_up WHERE id = $1",
      [id]
    ); 

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      id: user.id,
      full_name: user.full_name,
      under_ref: user.under_ref,
      hasReferrer: !!user.under_ref, // true if not null
    });
  } catch (error) {
    console.error("Error checking referral:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Test route to fetch user details by ID
router.get("/:id/details", getUserDetails);

router.get("/test-email", async (req, res) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // Use Resend's domain
      to: '700aditi@gmail.com', // ✅ YOUR VERIFIED EMAIL
      subject: 'Test Email from Resend - Knowo World',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #333;">✅ Test Email Successful!</h2>
          <p>This is a test email from your Knowo World application.</p>
          <p><strong>Server Time:</strong> ${new Date().toString()}</p>
          <p><strong>Domain:</strong> knowo.world</p>
          <p>If you received this, Resend is working perfectly! 🚀</p>
        </div>
      `
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send test email",
        error: error.message 
      });
    }

    res.json({ 
      success: true, 
      message: "Test email sent successfully via Resend!",
      emailId: data.id,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in /test-email:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: err.message 
    });
  }
});

module.exports = router;
