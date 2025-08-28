const pool = require("../config/db");

// Add video
exports.addVideo = async (req, res) => {
  try {
    const { title, video_url } = req.body;
    let finalUrl = req.file ? `/uploads/videos/${req.file.filename}` : video_url;

    if (!title || !finalUrl) {
      return res.status(400).json({ error: "Title and video required" });
    }

    const result = await pool.query(
      "INSERT INTO videos (title, video_url) VALUES ($1, $2) RETURNING *",
      [title, finalUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding video:", err.message);
    res.status(500).json({ error: "Failed to add video" });
  }
};

// Get all videos
exports.getVideos = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM videos ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching videos:", err.message);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
};

// ✅ Get 1 or 2 random videos
exports.getRandomVideos = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM videos ORDER BY RANDOM() LIMIT 2");

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No videos available" });
    }

    // Return array (1 or 2 videos)
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching random videos:", err.message);
    res.status(500).json({ error: "Failed to fetch random videos" });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM videos WHERE id=$1", [id]);
    res.json({ message: "Video deleted" });
  } catch (err) {
    console.error("Error deleting video:", err.message);
    res.status(500).json({ error: "Failed to delete video" });
  }
};
