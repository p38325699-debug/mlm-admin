// controllers/quizController.js
const pool = require("../config/db");

// Add quiz
exports.addQuiz = async (req, res) => {
  try {
    const { question, option_a, option_b, option_c, option_d, correct_option } = req.body;

    if (!question || !option_a || !option_b || !option_c || !option_d || !correct_option) {
      return res.status(400).json({ error: "All fields are required" });
    } 

    const result = await pool.query(
      `INSERT INTO quizzes (question, option_a, option_b, option_c, option_d, correct_option) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [question, option_a, option_b, option_c, option_d, correct_option]
    );

    res.status(201).json({ message: "Quiz added successfully", quiz: result.rows[0] });
  } catch (err) {
    console.error("Error adding quiz:", err.message);
    res.status(500).json({ error: "Failed to add quiz" });
  }
};

// Get all quizzes
exports.getQuizzes = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM quizzes ORDER BY RANDOM() LIMIT 5");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching quizzes:", err.message);
    res.status(500).json({ error: "Failed to fetch quizzes" });
  }
};


// Delete quiz
exports.deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("DELETE FROM quizzes WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json({ message: "Quiz deleted successfully", quiz: result.rows[0] });
  } catch (err) {
    console.error("Error deleting quiz:", err.message);
    res.status(500).json({ error: "Failed to delete quiz" });
  }
};

exports.getCoins = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    const result = await pool.query(
      "SELECT coin FROM sign_up WHERE id = $1",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      coin: result.rows[0].coin
    });
  } catch (err) {
    console.error("❌ Get coins error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateCoins = async (req, res) => {
  try {
    let { userId, commission } = req.body;

    console.log("👉 Received body:", req.body); // DEBUG LOG

    if (!userId || commission === undefined) {
      return res.status(400).json({ success: false, message: "Missing parameters" });
    }

    commission = parseFloat(commission);
    if (isNaN(commission)) {
      return res.status(400).json({ success: false, message: "Invalid commission value" });
    }

    const result = await pool.query(
      `UPDATE sign_up 
       SET coin = COALESCE(coin, 0) + $1 
       WHERE id = $2 
       RETURNING id, coin`,
      [commission, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Coins updated successfully",
      newBalance: result.rows[0].coin,
    });
  } catch (err) {
    console.error("❌ Coin update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


