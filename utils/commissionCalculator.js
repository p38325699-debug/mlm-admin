// backend/utils/commissionCalculator.js
function calculateCommission(
  business_plan = "Bronze",
  day_count = 0,
  score = 0,
  videosWatched = 0
) {
  // Ensure numeric
  const scoreNum = Number(score) || 0;
  const videosNum = Number(videosWatched) || 0;

  // Default Bronze rates
  let quizRate = 0.05;
  let videoRate = 0.05;

  // Plan-specific rates (quiz & video same)
  const planRates = {
    Silver: 0.216,
    Gold1: 0.40,
    Gold2: 0.80,
    Premium1: 2.25,
    Premium2: 4.5,
    Premium3: 9,
    Premium4: 22.5,
    Premium5: 45,
  };

  if (business_plan in planRates) {
    if (day_count > 0) {
      quizRate = planRates[business_plan];
      videoRate = planRates[business_plan]; // ✅ same rate
    } else {
      // Plan expired → fallback to Bronze
      quizRate = 0.05;
      videoRate = 0.05;
    }
  }

  // Calculate commissions properly
  const quizCommission = scoreNum * quizRate;
  const videoCommission = videosNum * videoRate;

  return Number((quizCommission + videoCommission).toFixed(3));
}

module.exports = calculateCommission;
