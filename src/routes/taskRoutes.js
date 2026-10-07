const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const FocusSession = require("../models/FocusSession");
const philippineDayNumber = require("../utils/philippineDayNumber");
const { TASK_CREDITS } = require("../utils/tempoRewards");

const router = express.Router();

function priorityFor(task, today) {
  const daysUntilDue =
    philippineDayNumber(task.deadline) - philippineDayNumber(today);
  let score = 0;

  if (daysUntilDue <= 0)
    score += 3; // Today or overdue
  else if (daysUntilDue === 1) score += 2; // Tomorrow

  if (task.difficulty === "high") score += 2;
  if (task.estimatedMinutes > 120) score += 1;

  return { score, daysUntilDue };
}

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.get("/", async (request, response, next) => {
  try {
    const filter = { deletedAt: null };

    if (request.query.user) {
      if (!validId(request.query.user)) {
        return response.status(400).json({ message: "Invalid user ID" });
      }
      filter.user = request.query.user;
    }

    if (request.query.status) {
      if (
        !["todo", "in_progress", "completed"].includes(request.query.status)
      ) {
        return response.status(400).json({ message: "Invalid task status" });
      }
      filter.status = request.query.status;
    }

    const tasks = await Task.find(filter).sort({ deadline: 1 });
    response.json(tasks);
  } catch (error) {
    next(error);
  }
});

// Put this route before /:id so Express does not treat "priorities" as an ID.
router.get("/priorities", async (request, response, next) => {
  try {
    const filter = { status: { $ne: "completed" }, deletedAt: null };

    if (request.query.user) {
      if (!validId(request.query.user)) {
        return response.status(400).json({ message: "Invalid user ID" });
      }
      filter.user = request.query.user;
    }

    const tasks = await Task.find(filter);
    const today = new Date();
    const rankedTasks = tasks.map((task) => {
      const priority = priorityFor(task, today);
      return {
        ...task.toObject(),
        priorityScore: priority.score,
        daysUntilDue: priority.daysUntilDue,
      };
    });

    rankedTasks.sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        new Date(a.deadline) - new Date(b.deadline),
    );

    response.json({
      rules: {
        todayOrOverdue: 3,
        tomorrow: 2,
        highDifficulty: 2,
        overTwoHours: 1,
      },
      tasks: rankedTasks,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    if (!validId(request.params.id)) {
      return response.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findById(request.params.id);
    if (!task) {
      return response.status(404).json({ message: "Task not found" });
    }

    response.json(task);
  } catch (error) {
    next(error);
  }
});

router.post("/", (request, response, next) =>
  require("../utils/seatLock")(async () => {
    try {
      const {
        user,
        title,
        description,
        deadline,
        difficulty,
        estimatedMinutes,
        requestKey,
      } = request.body || {};

      if (!validId(user)) {
        return response.status(400).json({ message: "Invalid user ID" });
      }

      if (requestKey !== undefined) {
        if (
          typeof requestKey !== "string" ||
          !requestKey ||
          requestKey.length > 120
        )
          return response.status(400).json({ message: "Invalid request key" });
        const saved = await Task.findOne({ user, requestKey });
        if (saved) return response.json(saved);
      }
      const existingUser = await User.findById(user);
      if (!existingUser) {
        return response.status(404).json({ message: "User not found" });
      }

      const task = await Task.create({
        user,
        title,
        description,
        deadline,
        difficulty,
        estimatedMinutes,
        requestKey,
      });
      response.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }).catch(next),
);

router.patch("/:id", async (request, response, next) => {
  try {
    if (!validId(request.params.id)) {
      return response.status(400).json({ message: "Invalid task ID" });
    }

    const changes = {};
    const allowedFields = [
      "title",
      "description",
      "deadline",
      "difficulty",
      "estimatedMinutes",
      "status",
    ];
    for (const field of allowedFields) {
      if (request.body && request.body[field] !== undefined) {
        changes[field] = request.body[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      return response
        .status(400)
        .json({ message: "Provide at least one task field to update" });
    }

    if (changes.status === "completed") {
      changes.completedAt = new Date();
      const qualified = await FocusSession.findOne({
        task: request.params.id,
        tempoCreditsEarned: { $gt: 0 },
      });
      // Setting a permanent award once avoids earning again by reopening a task.
      if (qualified) changes.tempoCreditsEarned = TASK_CREDITS;
    }
    if (changes.status === "todo" || changes.status === "in_progress")
      changes.completedAt = null;

    const task = await Task.findOneAndUpdate(
      { _id: request.params.id, deletedAt: null },
      changes,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!task) {
      return response.status(404).json({ message: "Task not found" });
    }

    response.json(task);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", (request, response, next) =>
  require("../utils/seatLock")(async () => {
    try {
      if (!validId(request.params.id)) {
        return response.status(400).json({ message: "Invalid task ID" });
      }

      const task = await Task.findById(request.params.id);
      if (!task || task.deletedAt) {
        return response.status(404).json({ message: "Task not found" });
      }

      const usedBySession = await FocusSession.findOne({
        task: task._id,
        status: { $in: ["planned", "active", "paused"] },
      });
      if (usedBySession) {
        return response
          .status(400)
          .json({
            message: "End this task’s current timer before deleting it",
          });
      }

      // Keep the record for session references and earned credits, but hide it from the board.
      await FocusSession.updateMany(
        {
          task: task._id,
          $or: [{ taskTitle: "" }, { taskTitle: { $exists: false } }],
        },
        { $set: { taskTitle: task.title } },
      );
      task.deletedAt = new Date();
      await task.save();

      response.json({ message: "Task deleted", task });
    } catch (error) {
      next(error);
    }
  }).catch(next),
);

module.exports = router;
