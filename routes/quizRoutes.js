// backend/routes/quizRoutes.js
const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

// Add new quiz
router.post("/quizzes", quizController.addQuiz);

// Get all quizzes
router.get("/quizzes", quizController.getQuizzes);

// Delete a quiz
router.delete("/quizzes/:id", quizController.deleteQuiz);

// ✅ Coins
router.post("/update-coins", quizController.updateCoins);
router.get("/get-coins/:userId", quizController.getCoins);

module.exports = router;
 