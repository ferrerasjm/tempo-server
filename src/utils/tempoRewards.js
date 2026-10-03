const FocusSession = require('../models/FocusSession');
const Task = require('../models/Task');
const Order = require('../models/Order');

const SESSION_CREDITS = 20;
const TASK_CREDITS = 15;
const BREAK_MINUTES = 5;

// Awards and paid orders are the source of truth; there is no editable balance.
async function tempoRewards(user) {
  const [sessions, tasks, orders] = await Promise.all([
    FocusSession.find({ user }), Task.find({ user }),
    Order.find({ user, creditsCharged: true, status: { $ne: 'cancelled' } }),
  ]);
  const earnedCredits = sessions.reduce((sum, item) => sum + (item.tempoCreditsEarned || 0), 0)
    + tasks.reduce((sum, item) => sum + (item.tempoCreditsEarned || 0), 0);
  const spentCredits = orders.reduce((sum, item) => sum + item.totalCredits, 0);
  const used = {};
  for (const session of sessions) {
    for (const reward of session.rewardBreaks || []) {
      const key = String(reward.order) + ':' + String(reward.menuItem);
      used[key] = (used[key] || 0) + 1;
    }
  }
  const items = [];
  for (const order of orders) {
    for (const item of order.items) {
      const quantity = item.quantity - (used[String(order._id) + ':' + String(item.menuItem)] || 0);
      if (quantity > 0) items.push({ order: order._id, menuItem: item.menuItem, name: item.name, category: item.category, quantity });
    }
  }
  return {
    balance: earnedCredits - spentCredits, earnedCredits, spentCredits, items, breakMinutes: BREAK_MINUTES,
    missions: [
      { key: 'focus', title: 'Finish a full focus timer', credits: SESSION_CREDITS, completed: sessions.filter(item => item.tempoCreditsEarned > 0).length },
      { key: 'task', title: 'Complete its task after a full focus session', credits: TASK_CREDITS, completed: tasks.filter(item => item.tempoCreditsEarned > 0).length },
    ],
  };
}

module.exports = { tempoRewards, SESSION_CREDITS, TASK_CREDITS, BREAK_MINUTES };
