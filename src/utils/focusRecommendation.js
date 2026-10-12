const philippineDayNumber = require("./philippineDayNumber");

function focusRecommendation(task, energyLevel) {
  const energyMinutes = { low: 25, medium: 40, high: 50 };
  let plannedMinutes = energyMinutes[energyLevel];

  if (task.difficulty === "high") plannedMinutes -= 10;
  if (task.difficulty === "low") plannedMinutes += 5;

  const daysUntilDue =
    philippineDayNumber(task.deadline) - philippineDayNumber(new Date());
  if (daysUntilDue <= 1) plannedMinutes += 5;

  plannedMinutes = Math.max(
    15,
    Math.floor(Math.min(plannedMinutes, task.estimatedMinutes)),
  );

  let breakMinutes = 5;
  if (plannedMinutes > 45) breakMinutes = 15;
  else if (plannedMinutes > 25) breakMinutes = 10;

  return { plannedMinutes, breakMinutes, daysUntilDue };
}

module.exports = focusRecommendation;
