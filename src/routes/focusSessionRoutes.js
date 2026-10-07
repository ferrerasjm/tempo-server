const express = require("express");
const mongoose = require("mongoose");
const FocusSession = require("../models/FocusSession");
const Task = require("../models/Task");
const CafeArea = require("../models/CafeArea");
const User = require("../models/User");
const MenuItem = require("../models/MenuItem");
const Reservation = require("../models/Reservation");
const getPeakReservedSeats = require("../utils/seatAvailability");
const withSeatLock = require("../utils/seatLock");
const { elapsedMilliseconds, sessionEndsAt } = require("../utils/sessionClock");
const {
  tempoRewards,
  SESSION_CREDITS,
  TASK_CREDITS,
  BREAK_MINUTES,
} = require("../utils/tempoRewards");
const focusRecommendation = require("../utils/focusRecommendation");

const router = express.Router();

function withFocusScore(session) {
  const result = session.toObject();
  if (session.task && typeof session.task === "object" && session.task.title) {
    result.task = session.task._id;
    result.taskTitle = result.taskTitle || session.task.title;
  }
  result.elapsedSeconds = Math.floor(elapsedMilliseconds(session) / 1000);
  result.serverTime = new Date().toISOString();
  result.focusScore =
    session.status === "completed"
      ? Math.round((session.completedMinutes / session.plannedMinutes) * 100)
      : null;
  return result;
}


router.get("/", async (request, response, next) => {
  try {
    const filter = {};

    if (!request.query.user) {
      return response.status(400).json({ message: "User ID is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(request.query.user)) {
      return response.status(400).json({ message: "Invalid user ID" });
    }
    filter.user = request.query.user;

    if (request.query.status) {
      if (
        !["planned", "active", "paused", "completed", "cancelled"].includes(
          request.query.status,
        )
      ) {
        return response
          .status(400)
          .json({ message: "Invalid focus session status" });
      }
      filter.status = request.query.status;
    }

    const sessions = await FocusSession.find(filter)
      .populate("task", "title")
      .sort({ startedAt: -1 });
    response.json(sessions.map(withFocusScore));
  } catch (error) {
    next(error);
  }
});


router.get("/:id", async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: "Invalid focus session ID" });
    }

    const session = await FocusSession.findById(request.params.id).populate(
      "task",
      "title",
    );
    if (!session) {
      return response.status(404).json({ message: "Focus session not found" });
    }

    response.json(withFocusScore(session));
  } catch (error) {
    next(error);
  }
});

// Check the whole remaining focus window, including future bookings.
async function seatError(user, areaId, minutes, now) {
  const area = await CafeArea.findById(areaId);
  if (!area) return "Cafe area not found";
  if (!area.active) return "This cafe area is unavailable";
  const end = new Date(now.getTime() + minutes * 60000);
  const own = await Reservation.findOne({
    user,
    status: "active",
    startsAt: { $lt: end },
    endsAt: { $gt: now },
  });
  if (own)
    return "You already have a reservation during this session. Cancel it before starting a focus session.";
  const seats = await getPeakReservedSeats(areaId, now, end);
  if (seats >= area.capacity)
    return "No seats remain in this cafe area for this session";
  return "";
}

// Size-based sessions start as planned; the timer starts when a seat is taken.
router.post("/", (request, response, next) =>
  withSeatLock(async () => {
    try {
      const {
        user,
        task,
        area,
        energyLevel,
        drink,
        drinkSize,
        sessionLabel,
        requestKey,
      } = request.body || {};
      const status = (request.body || {}).status || "active";
      if (
        !mongoose.Types.ObjectId.isValid(user) ||
        !mongoose.Types.ObjectId.isValid(task) ||
        !mongoose.Types.ObjectId.isValid(area)
      ) {
        return response
          .status(400)
          .json({
            message: "Valid user, task, and cafe area IDs are required",
          });
      }
      if (!["low", "medium", "high"].includes(energyLevel))
        return response
          .status(400)
          .json({ message: "Energy level must be low, medium, or high" });
      if (!["planned", "active"].includes(status))
        return response
          .status(400)
          .json({ message: "New sessions must be planned or active" });
      if (
        sessionLabel !== undefined &&
        (typeof sessionLabel !== "string" || sessionLabel.trim().length > 80)
      ) {
        return response
          .status(400)
          .json({ message: "Session label must be text within 80 characters" });
      }
      if (requestKey !== undefined) {
        if (
          typeof requestKey !== "string" ||
          !requestKey ||
          requestKey.length > 120
        )
          return response.status(400).json({ message: "Invalid request key" });
        const saved = await FocusSession.findOne({ user, requestKey });
        if (saved) return response.json(withFocusScore(saved));
      }
      const existingUser = await User.findById(user);
      if (!existingUser)
        return response.status(404).json({ message: "User not found" });
      const existingTask = await Task.findById(task);
      if (existingTask?.deletedAt)
        return response.status(404).json({ message: "Task not found" });
      if (!existingTask)
        return response.status(404).json({ message: "Task not found" });
      if (String(existingTask.user) !== String(user))
        return response
          .status(400)
          .json({ message: "Task does not belong to this user" });
      if (existingTask.status === "completed")
        return response
          .status(400)
          .json({ message: "Choose an unfinished task" });
      const existingArea = await CafeArea.findById(area);
      if (!existingArea)
        return response.status(404).json({ message: "Cafe area not found" });
      if (!existingArea.active)
        return response
          .status(400)
          .json({ message: "This cafe area is unavailable" });
      const unfinished = await FocusSession.findOne({
        user,
        status: { $in: ["planned", "active", "paused"] },
      });
      if (unfinished)
        return response
          .status(400)
          .json({
            message: "Finish or cancel your existing focus session first",
          });
      const recommendation = focusRecommendation(existingTask, energyLevel);
      let selectedDrink = null;
      const sizeMinutes = { tall: 25, grande: 45, venti: 60 };
      if (drink || drinkSize) {
        if (
          !mongoose.Types.ObjectId.isValid(drink) ||
          !["tall", "grande", "venti"].includes(drinkSize)
        ) {
          return response
            .status(400)
            .json({
              message: "Choose a valid drink and size: tall, grande, or venti",
            });
        }
        selectedDrink = await MenuItem.findById(drink);
        if (
          !selectedDrink ||
          selectedDrink.category !== "drink" ||
          !selectedDrink.available
        ) {
          return response
            .status(400)
            .json({ message: "Choose an available drink" });
        }
      }
      const plannedMinutes = selectedDrink
        ? sizeMinutes[drinkSize]
        : recommendation.plannedMinutes;
      const breakMinutes = selectedDrink
        ? plannedMinutes > 45
          ? 15
          : plannedMinutes > 25
            ? 10
            : 5
        : recommendation.breakMinutes;
      const now = new Date();
      if (status === "active") {
        const message = await seatError(user, area, plannedMinutes, now);
        if (message) return response.status(400).json({ message });
      }
      const session = await FocusSession.create({
        user,
        task,
        requestKey,
        taskTitle: existingTask.title,
        area,
        energyLevel,
        plannedMinutes,
        breakMinutes,
        status,
        drink: selectedDrink ? selectedDrink._id : null,
        drinkName: selectedDrink ? selectedDrink.name : "",
        drinkSize: selectedDrink ? drinkSize : "",
        sessionLabel: sessionLabel || "",
        startedAt: status === "active" ? now : null,
      });
      response.status(201).json(withFocusScore(session));
    } catch (error) {
      next(error);
    }
  }).catch(next),
);


router.patch("/:id", (request, response, next) =>
  withSeatLock(async () => {
    try {
      if (!mongoose.Types.ObjectId.isValid(request.params.id))
        return response
          .status(400)
          .json({ message: "Invalid focus session ID" });
      const session = await FocusSession.findById(request.params.id);
      if (!session)
        return response
          .status(404)
          .json({ message: "Focus session not found" });
      const { action, status, area, rewardOrder, rewardItem, taskCompleted } =
        request.body || {};
      const now = new Date();
      if (action === "confirm_task") {
        if (session.status !== "completed")
          return response
            .status(400)
            .json({ message: "Save the session before confirming its task" });
        if (typeof taskCompleted !== "boolean")
          return response
            .status(400)
            .json({ message: "Confirm whether the task is complete" });
        if (session.taskConfirmed)
          return response.json(withFocusScore(session));
        const task = await Task.findById(session.task);
        if (!task)
          return response.status(404).json({ message: "Task not found" });
        if (task.deletedAt) {
          session.taskConfirmed = true;
          session.taskCompleted = taskCompleted;
          await session.save();
          return response.json(withFocusScore(session));
        }
        // A late confirmation from an older session must never reopen a task that
        // has already been completed. Reopening remains an explicit Task Board action.
        const alreadyCompleted = task.status === "completed";
        const taskChangedAfterSession = Boolean(
          session.endedAt &&
            task.updatedAt &&
            new Date(task.updatedAt) > new Date(session.endedAt),
        );
        if (!taskChangedAfterSession && taskCompleted) {
          task.status = "completed";
          task.completedAt = task.completedAt || now;
          if (
            await FocusSession.exists({
              task: task._id,
              tempoCreditsEarned: { $gt: 0 },
            })
          )
            task.tempoCreditsEarned = TASK_CREDITS;
          await task.save();
        } else if (!taskChangedAfterSession && !alreadyCompleted) {
          task.status = "in_progress";
          task.completedAt = null;
          await task.save();
        }
        session.taskConfirmed = true;
        session.taskCompleted = taskChangedAfterSession
          ? alreadyCompleted
          : taskCompleted || alreadyCompleted;
        await session.save();
        return response.json(withFocusScore(session));
      }
      if (action) {
        if (!["start", "pause", "resume", "move", "stop"].includes(action))
          return response
            .status(400)
            .json({ message: "Unknown session action" });
        if (["completed", "cancelled"].includes(session.status))
          return response
            .status(400)
            .json({ message: "This session has already ended" });
        if (action === "start" || action === "resume" || action === "move") {
          if (action === "start" && session.status !== "planned")
            return response
              .status(400)
              .json({ message: "Only planned sessions can start" });
          if (action === "resume" && session.status !== "paused")
            return response
              .status(400)
              .json({ message: "Only paused sessions can resume" });

          const target = area || session.area;
          if (!mongoose.Types.ObjectId.isValid(target))
            return response
              .status(400)
              .json({ message: "Invalid cafe area ID" });
          if (action === "move" && String(target) === String(session.area))
            return response.json(withFocusScore(session));
          if (action === "move" && session.status !== "active") {
            const selected = await CafeArea.findById(target);
            if (!selected || !selected.active)
              return response
                .status(400)
                .json({ message: "This cafe area is unavailable" });
            session.area = target;
            await session.save();
            return response.json(withFocusScore(session));
          }
          const remainingMinutes = Math.max(
            0,
            session.plannedMinutes - elapsedMilliseconds(session, now) / 60000,
          );
          if (!remainingMinutes)
            return response
              .status(400)
              .json({
                message: "The timer has ended. Stop and save this session.",
              });
          const message = await seatError(
            session.user,
            target,
            remainingMinutes,
            now,
          );
          if (message) return response.status(400).json({ message });
          session.area = target;
          if (action === "start") session.startedAt = now;
          if (action === "resume")
            session.pausedMilliseconds =
              (session.pausedMilliseconds || 0) +
              now.getTime() -
              session.pausedAt.getTime();
          session.pausedAt = null;
          session.rewardBreakEndsAt = null;
          session.status = "active";
        } else if (action === "pause") {
          if (session.status !== "active")
            return response
              .status(400)
              .json({ message: "Only running sessions can pause" });
          if (
            elapsedMilliseconds(session, now) >=
            session.plannedMinutes * 60000
          )
            return response
              .status(400)
              .json({
                message: "Your timer is complete. Stop and save your session.",
              });
          session.rewardBreakEndsAt = null;
          // Ordinary pauses freeze the timer until the user resumes it.
          // A supplied reward still consumes one item for a timed break.
          if (rewardOrder !== undefined || rewardItem !== undefined) {
            if (
              !mongoose.Types.ObjectId.isValid(rewardOrder) ||
              !mongoose.Types.ObjectId.isValid(rewardItem)
            ) {
              return response
                .status(400)
                .json({
                  message: "Valid reward order and item IDs are required.",
                });
            }
            const rewards = await tempoRewards(session.user);
            const item = rewards.items.find(
              (item) =>
                String(item.order) === String(rewardOrder) &&
                String(item.menuItem) === String(rewardItem),
            );
            if (!item)
              return response
                .status(400)
                .json({
                  message:
                    "This reward item is unavailable or has already been used.",
                });
            const rewardMinutes = item.breakMinutes || BREAK_MINUTES;
            const endsAt = new Date(now.getTime() + rewardMinutes * 60000);
            session.rewardBreaks.push({
              order: item.order,
              menuItem: item.menuItem,
              name: item.name,
              breakMinutes: rewardMinutes,
              startedAt: now,
              endsAt,
            });
            session.rewardBreakEndsAt = endsAt;
          }
          session.status = "paused";
          session.pausedAt = now;
        } else {
          const minutes = Math.min(
            session.plannedMinutes,
            120,
            Math.floor(elapsedMilliseconds(session, now) / 60000),
          );
          session.completedMinutes = minutes;
          session.status = minutes > 0 ? "completed" : "cancelled";
          if (
            elapsedMilliseconds(session, now) >=
            session.plannedMinutes * 60000
          )
            session.tempoCreditsEarned = SESSION_CREDITS;
          if (session.pausedAt)
            session.pausedMilliseconds =
              (session.pausedMilliseconds || 0) +
              now.getTime() -
              session.pausedAt.getTime();
          session.pausedAt = null;
          session.rewardBreakEndsAt = null;
          session.endedAt = now;
          session.breakStartedAt =
            session.status === "completed" &&
            elapsedMilliseconds(session, now) >= session.plannedMinutes * 60000
              ? sessionEndsAt(session)
              : null;
        }
      } else {
        if (!["completed", "cancelled"].includes(status))
          return response
            .status(400)
            .json({ message: "Status must be completed or cancelled" });
        if (!["planned", "active", "paused"].includes(session.status))
          return response
            .status(400)
            .json({ message: "This session has already ended" });
        if (status === "completed" && !session.startedAt)
          return response
            .status(400)
            .json({ message: "Only started sessions can be completed" });
        const elapsed = elapsedMilliseconds(session, now);
        const minutes = Math.min(
          session.plannedMinutes,
          Math.floor(elapsed / 60000),
        );
        if (session.pausedAt)
          session.pausedMilliseconds +=
            now.getTime() - session.pausedAt.getTime();
        session.pausedAt = null;
        session.rewardBreakEndsAt = null;
        session.status =
          status === "completed" && minutes > 0 ? "completed" : "cancelled";
        session.completedMinutes = session.status === "completed" ? minutes : 0;
        session.endedAt = now;
        session.breakStartedAt =
          session.status === "completed" &&
          elapsed >= session.plannedMinutes * 60000
            ? sessionEndsAt(session)
            : null;
        if (
          session.status === "completed" &&
          elapsed >= session.plannedMinutes * 60000
        )
          session.tempoCreditsEarned = SESSION_CREDITS;
      }
      await session.save();
      // A task marked done before its timer finishes also receives its one-time award.
      if (session.tempoCreditsEarned > 0)
        await Task.updateOne(
          { _id: session.task, status: "completed" },
          { $set: { tempoCreditsEarned: TASK_CREDITS } },
        );
      response.json(withFocusScore(session));
    } catch (error) {
      next(error);
    }
  }).catch(next),
);

module.exports = router;
