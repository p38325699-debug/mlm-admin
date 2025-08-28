const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");

const router = express.Router();

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// POST /api/home-data
router.post("/home-data", upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const bannerUrl = `/uploads/${req.file.filename}`;
    await pool.query(
      "INSERT INTO home_data (banner_url) VALUES ($1)",
      [bannerUrl]
    );

    // Send full URL so frontend doesn't need to prepend BASE_URL
    const fullUrl = `${req.protocol}://${req.get("host")}${bannerUrl}`;

    res.json({ success: true, banner_url: fullUrl });
  } catch (err) {
    console.error("Error inserting banner:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/home-data
router.get("/home-data", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, banner_url, created_at FROM home_data ORDER BY created_at ASC"
    );

    // Add full URL for each banner
    const dataWithFullUrl = result.rows.map((row) => ({
      ...row,
      banner_url: `${req.protocol}://${req.get("host")}${row.banner_url}`,
    }));

    res.json(dataWithFullUrl);
  } catch (err) {
    console.error("Error fetching banners:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/home-data/:id
router.delete("/home-data/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT banner_url FROM home_data WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    // Remove leading slash so path.join works
    const relativePath = result.rows[0].banner_url.replace(/^\//, "");
    const filePath = path.join(__dirname, "..", relativePath);

    await pool.query("DELETE FROM home_data WHERE id = $1", [id]);

    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });

    res.json({ success: true, message: "Banner deleted" });
  } catch (err) {
    console.error("Error deleting banner:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
