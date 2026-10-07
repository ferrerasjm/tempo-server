const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const FocusSession = require("../models/FocusSession");
const CafeArea = require("../models/CafeArea");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const focusRecommendation = require("../utils/focusRecommendation");
const focusStreak = require("../utils/focusStreak");
const philippineDayNumber = require("../utils/philippineDayNumber");

const router = express.Router();

async function findUser(request, response) {
  const userId = request.query.user;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    response.status(400).json({ message: "Valid user ID is required" });
    return null;
  }
  const user = await User.findById(userId);
  if (!user) response.status(404).json({ message: "User not found" });
  return user;
}

router.post("/recommendation", async (request, response, next) => {
  try {
    const { task, energyLevel } = request.body || {};

    if (!mongoose.Types.ObjectId.isValid(task)) {
      return response.status(400).json({ message: "Invalid task ID" });
    }
    if (!["low", "medium", "high"].includes(energyLevel)) {
      return response
        .status(400)
        .json({ message: "Energy level must be low, medium, or high" });
    }

    const existingTask = await Task.findById(task);
    if (!existingTask || existingTask.deletedAt) {
      return response.status(404).json({ message: "Task not found" });
    }
    if (existingTask.status === "completed") {
      return response
        .status(400)
        .json({ message: "Choose an unfinished task" });
    }

    const recommendation = focusRecommendation(existingTask, energyLevel);
    response.json({
      task: existingTask._id,
      energyLevel,
      difficulty: existingTask.difficulty,
      estimatedMinutes: existingTask.estimatedMinutes,
      ...recommendation,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/streak", async (request, response, next) => {
  try {
    const user = await findUser(request, response);
    if (!user) return;

    const sessions = await FocusSession.find({
      user: user._id,
      status: "completed",
    });
    response.json(focusStreak(sessions));
  } catch (error) {
    next(error);
  }
});

router.get("/statistics", async (request, response, next) => {
  try {
    const user = await findUser(request, response);
    if (!user) return;

    const sessions = await FocusSession.find({
      user: user._id,
      status: "completed",
    });
    const completedTasks = await Task.countDocuments({
      user: user._id,
      status: "completed",
    });
    const orders = await Order.find({
      user: user._id,
      status: { $ne: "cancelled" },
    });
    const drinks = await MenuItem.find({ category: "drink" });

    let totalFocusMinutes = 0;
    const minutesByDay = {};
    const minutesByArea = {};
    for (const session of sessions) {
      totalFocusMinutes += session.completedMinutes;
      if (session.endedAt) {
        const day = philippineDayNumber(session.endedAt);
        minutesByDay[day] = (minutesByDay[day] || 0) + session.completedMinutes;
      }
      if (session.area) {
        const areaId = String(session.area);
        minutesByArea[areaId] =
          (minutesByArea[areaId] || 0) + session.completedMinutes;
      }
    }

    let mostProductiveDay = null;
    for (const [day, minutes] of Object.entries(minutesByDay)) {
      if (!mostProductiveDay || minutes > mostProductiveDay.totalMinutes) {
        mostProductiveDay = {
          date: new Date(Number(day) * 86400000).toISOString().slice(0, 10),
          totalMinutes: minutes,
        };
      }
    }

    let favoriteCafeArea = null;
    for (const [areaId, minutes] of Object.entries(minutesByArea)) {
      if (!favoriteCafeArea || minutes > favoriteCafeArea.totalMinutes) {
        favoriteCafeArea = {
          id: areaId,
          totalMinutes: minutes,
        };
      }
    }
    if (favoriteCafeArea) {
      const area = await CafeArea.findById(favoriteCafeArea.id);
      favoriteCafeArea.name = area ? area.name : "Deleted cafe area";
    }

    const drinkIds = new Set(drinks.map((drink) => String(drink._id)));
    const quantitiesByDrink = {};
    for (const order of orders) {
      for (const item of order.items) {
        const drinkId = String(item.menuItem);
        if (drinkIds.has(drinkId)) {
          quantitiesByDrink[drinkId] =
            (quantitiesByDrink[drinkId] || 0) + item.quantity;
        }
      }
    }

    let mostOrderedDrink = null;
    for (const drink of drinks) {
      const quantity = quantitiesByDrink[String(drink._id)] || 0;
      if (
        quantity > 0 &&
        (!mostOrderedDrink || quantity > mostOrderedDrink.quantity)
      ) {
        mostOrderedDrink = { id: drink._id, name: drink.name, quantity };
      }
    }

    response.json({
      totalFocusMinutes,
      averageSessionMinutes: sessions.length
        ? Math.round(totalFocusMinutes / sessions.length)
        : 0,
      completedSessions: sessions.length,
      completedTasks,
      ...focusStreak(sessions),
      mostProductiveDay,
      favoriteCafeArea,
      mostOrderedDrink,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
