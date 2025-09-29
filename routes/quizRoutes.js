// backend/routes/quizRoutes.js
const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");
const multer = require("multer");
const path = require("path");

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => 
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// Quiz routes
router.post("/quizzes", quizController.addQuiz);
router.get("/quizzes", quizController.getQuizzes);
router.delete("/quizzes/:id", (req, res) => {
  req.params.type = "quiz";
  quizController.deleteItem(req, res);
});
 
// Video routes
router.post("/videos", upload.single("videoFile"), quizController.addVideo); // <-- updated
router.delete("/videos/:id", (req, res) => {
  req.params.type = "video";
  quizController.deleteItem(req, res);
});

// Admin: fetch quizzes + videos
router.get("/quiz-with-videos", quizController.getQuizWithVideos);

// Coins
router.get("/coins/:userId", quizController.getCoins);
router.post("/update-coins", quizController.updateCoins);

module.exports = router;
