const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const FocusSession = require('../models/FocusSession');

const router = express.Router();

// Cafe Tempo uses Philippine calendar days when ranking deadlines.
function philippineDayNumber(date) {
  const eightHours = 8 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((date.getTime() + eightHours) / oneDay);
}

function priorityFor(task, today) {
  const daysUntilDue = philippineDayNumber(task.deadline) - philippineDayNumber(today);
  let score = 0;

  if (daysUntilDue <= 0) score += 3; // Today or overdue
  else if (daysUntilDue === 1) score += 2; // Tomorrow

  if (task.difficulty === 'high') score += 2;
  if (task.estimatedMinutes > 120) score += 1;

  return { score, daysUntilDue };
}

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/tasks?user=<id>&status=todo
router.get('/', async (request, response, next) => {
  try {
    const filter = {};

    if (request.query.user) {
      if (!validId(request.query.user)) {
        return response.status(400).json({ message: 'Invalid user ID' });
      }
      filter.user = request.query.user;
    }

    if (request.query.status) {
      if (!['todo', 'in_progress', 'completed'].includes(request.query.status)) {
        return response.status(400).json({ message: 'Invalid task status' });
      }
      filter.status = request.query.status;
    }

    const tasks = await Task.find(filter).sort({ deadline: 1 });
    response.json(tasks);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/priorities?user=<id>
// Put this route before /:id so Express does not treat "priorities" as an ID.
router.get('/priorities', async (request, response, next) => {
  try {
    const filter = { status: { $ne: 'completed' } };

    if (request.query.user) {
      if (!validId(request.query.user)) {
        return response.status(400).json({ message: 'Invalid user ID' });
      }
      filter.user = request.query.user;
    }

    const tasks = await Task.find(filter);
    const today = new Date();
    const rankedTasks = tasks.map(task => {
      const priority = priorityFor(task, today);
      return { ...task.toObject(), priorityScore: priority.score, daysUntilDue: priority.daysUntilDue };
    });

    rankedTasks.sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.deadline) - new Date(b.deadline));

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

// GET /api/tasks/:id
router.get('/:id', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) {
      return response.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(request.params.id);
    if (!task) {
      return response.status(404).json({ message: 'Task not found' });
    }

    response.json(task);
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks
router.post('/', async (request, response, next) => {
  try {
    const { user, title, description, deadline, difficulty, estimatedMinutes } = request.body || {};

    if (!validId(user)) {
      return response.status(400).json({ message: 'Invalid user ID' });
    }

    const existingUser = await User.findById(user);
    if (!existingUser) {
      return response.status(404).json({ message: 'User not found' });
    }

    const task = await Task.create({ user, title, description, deadline, difficulty, estimatedMinutes });
    response.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) {
      return response.status(400).json({ message: 'Invalid task ID' });
    }

    const changes = {};
    const allowedFields = ['title', 'description', 'deadline', 'difficulty', 'estimatedMinutes', 'status'];
    for (const field of allowedFields) {
      if (request.body && request.body[field] !== undefined) {
        changes[field] = request.body[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      return response.status(400).json({ message: 'Provide at least one task field to update' });
    }

    if (changes.status === 'completed') changes.completedAt = new Date();
    if (changes.status === 'todo' || changes.status === 'in_progress') changes.completedAt = null;

    const task = await Task.findByIdAndUpdate(request.params.id, changes, {
      new: true,
      runValidators: true,
    });

    if (!task) {
      return response.status(404).json({ message: 'Task not found' });
    }

    response.json(task);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (request, response, next) => {
  try {
    if (!validId(request.params.id)) {
      return response.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(request.params.id);
    if (!task) {
      return response.status(404).json({ message: 'Task not found' });
    }

    const usedBySession = await FocusSession.findOne({ task: task._id });
    if (usedBySession) {
      return response.status(400).json({ message: 'Cannot delete a task linked to a focus session' });
    }

    await Task.findByIdAndDelete(request.params.id);

    response.json({ message: 'Task deleted', task });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
