// A day begins at midnight in the Philippines (UTC+8).
function philippineDayNumber(date) {
  const eightHours = 8 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((date.getTime() + eightHours) / oneDay);
}

module.exports = philippineDayNumber;
