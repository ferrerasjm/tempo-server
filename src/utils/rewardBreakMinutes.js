const PASTRY_BREAK_MINUTES = Object.freeze({
  "Chocolate Donut": 5,
  "Egg Tart": 5,
  Croissant: 5,
  "Blueberry Muffin": 10,
  "Cinnamon Roll": 10,
  "Fruit Tart": 15,
});

function rewardBreakMinutes(name) {
  return PASTRY_BREAK_MINUTES[name] || 5;
}

module.exports = { PASTRY_BREAK_MINUTES, rewardBreakMinutes };
