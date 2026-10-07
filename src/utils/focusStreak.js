const philippineDayNumber = require("./philippineDayNumber");

function focusStreak(sessions, today = new Date()) {
  const days = [
    ...new Set(
      sessions
        .filter((session) => session.endedAt)
        .map((session) => philippineDayNumber(session.endedAt)),
    ),
  ].sort((a, b) => b - a);

  if (days.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longestStreak = 1;
  let runningStreak = 1;
  for (let index = 1; index < days.length; index++) {
    if (days[index - 1] - days[index] === 1) runningStreak++;
    else runningStreak = 1;
    if (runningStreak > longestStreak) longestStreak = runningStreak;
  }

  const todayNumber = philippineDayNumber(today);
  let currentStreak = 0;
  if (days[0] === todayNumber || days[0] === todayNumber - 1) {
    currentStreak = 1;
    for (let index = 1; index < days.length; index++) {
      if (days[index - 1] - days[index] !== 1) break;
      currentStreak++;
    }
  }

  return { currentStreak, longestStreak };
}

module.exports = focusStreak;
