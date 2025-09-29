// controllers/quizController.js
const pool = require("../config/db");

const calculateCommission = require("../utils/commissionCalculator");
 
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

// controllers/quizController.js
exports.addVideo = async (req, res) => {
  try {
    const { title } = req.body;
    let video_url = req.body.video_url;

    // If a file is uploaded, override video_url with file path
    if (req.file) {
      video_url = `/uploads/${req.file.filename}`;
    }

    if (!title || !video_url) {
      return res.status(400).json({ error: "Title and video (URL or file) required" });
    }

    const result = await pool.query(
      `INSERT INTO videos (title, video_url) VALUES ($1, $2) RETURNING *`,
      [title, video_url]
    );

    res.status(201).json({
      message: "Video added successfully",
      video: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error adding video:", err.message);
    res.status(500).json({ error: "Failed to add video" });
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

// Get quizzes + videos (supports admin flag)
exports.getQuizWithVideos = async (req, res) => {
  try {
    const isAdmin = req.query.admin === "true"; // admin? fetch all

    // Quizzes query
    const quizQuery = isAdmin
      ? "SELECT * FROM quizzes ORDER BY id ASC" // all quizzes
      : "SELECT * FROM quizzes ORDER BY RANDOM() LIMIT 5"; // app limit

    // Videos query
    const videoQuery = isAdmin
      ? "SELECT * FROM videos ORDER BY id ASC" // all videos
      : "SELECT * FROM videos ORDER BY RANDOM() LIMIT 2"; // app limit

    const quizzes = await pool.query(quizQuery);
    const videos = await pool.query(videoQuery);

    res.json({
      success: true,
      quizzes: quizzes.rows,
      videos: videos.rows,
    });
  } catch (err) {
    console.error("Error fetching quiz/videos:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch data" });
  }
};

// Delete quiz or video
exports.deleteItem = async (req, res) => {
  try {
    const { id, type } = req.params; // type = "quiz" or "video"

    if (!id || !type) {
      return res.status(400).json({ error: "Missing id or type" });
    }

    let tableName = "";
    if (type === "quiz") tableName = "quizzes";
    else if (type === "video") tableName = "videos";
    else return res.status(400).json({ error: "Invalid type" });

    const result = await pool.query(
      `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `${type} not found` });
    }

    res.json({ message: `${type} deleted successfully`, item: result.rows[0] });
  } catch (err) {
    console.error(`Error deleting ${req.params.type}:`, err.message);
    res.status(500).json({ error: "Failed to delete item" });
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


// ✅ Update Coins
exports.updateCoins = async (req, res) => {
  try {
    const { userId, score = 0, videosWatched = 0 } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    // 1. Fetch user info
    const userQuery = `
      SELECT business_plan, COALESCE(day_count, 0) AS day_count, COALESCE(coin, 0) AS coin
      FROM sign_up 
      WHERE id = $1
    `;
    const { rows, rowCount } = await pool.query(userQuery, [userId]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let { business_plan, day_count, coin } = rows[0];

    // ✅ Make sure coin is a number
    coin = parseFloat(coin) || 0;

    // 2. Calculate commission
    const commission = calculateCommission(business_plan, day_count, score, videosWatched);

    // 3. Decide whether to decrement day_count
    const shouldDecrement = business_plan !== "Bronze" && day_count > 0;

    // 4. Update database
    const updateQuery = `
      UPDATE sign_up
      SET 
        coin = $1,
        day_count = CASE WHEN $2 THEN day_count - 1 ELSE day_count END
      WHERE id = $3
      RETURNING id, coin, day_count, business_plan
    `;

    const updated = await pool.query(updateQuery, [coin + commission, shouldDecrement, userId]);

    // ✅ Ensure response numbers are floats
    res.json({
  success: true,
  message: "Coins updated successfully",
  commission: Number(commission), // force number
  newBalance: Number(updated.rows[0].coin),
  day_count: Number(updated.rows[0].day_count),
  business_plan: updated.rows[0].business_plan,
});


  } catch (err) {
    console.error("❌ Coin update error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};









