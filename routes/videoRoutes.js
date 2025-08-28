// backend/routes/videoRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { addVideo, getVideos, deleteVideo, getRandomVideos } = require("../controllers/videoController");

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/videos/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Routes
router.post("/videos", upload.single("videoFile"), addVideo);
router.get("/videos", getVideos);             // all videos
router.get("/videos/random", getRandomVideos); // random 2 videos

router.delete("/videos/:id", deleteVideo);

module.exports = router;
