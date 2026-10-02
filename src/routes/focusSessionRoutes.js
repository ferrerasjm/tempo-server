const express = require('express');
const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const Task = require('../models/Task');
const CafeArea = require('../models/CafeArea');
const User = require('../models/User');
const focusRecommendation = require('../utils/focusRecommendation');

const router = express.Router();

function withFocusScore(session) {
  const result = session.toObject();
  result.focusScore = session.status === 'completed'
    ? Math.round(session.completedMinutes / session.plannedMinutes * 100)
    : null;
  return result;
}

// GET /api/focus-sessions?user=<id>&status=completed
router.get('/', async (request, response, next) => {
  try {
    const filter = {};

    if (request.query.user) {
      if (!mongoose.Types.ObjectId.isValid(request.query.user)) {
        return response.status(400).json({ message: 'Invalid user ID' });
      }
      filter.user = request.query.user;
    }

    if (request.query.status) {
      if (!['planned', 'active', 'completed', 'cancelled'].includes(request.query.status)) {
        return response.status(400).json({ message: 'Invalid focus session status' });
      }
      filter.status = request.query.status;
    }

    const sessions = await FocusSession.find(filter).sort({ startedAt: -1 });
    response.json(sessions.map(withFocusScore));
  } catch (error) {
    next(error);
  }
});

// GET /api/focus-sessions/:id
router.get('/:id', async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: 'Invalid focus session ID' });
    }

    const session = await FocusSession.findById(request.params.id);
    if (!session) {
      return response.status(404).json({ message: 'Focus session not found' });
    }

    response.json(withFocusScore(session));
  } catch (error) {
    next(error);
  }
});

// POST /api/focus-sessions with { user, task, area, energyLevel }
router.post('/', async (request, response, next) => {
  try {
    const { user, task, area, energyLevel } = request.body || {};

    if (!mongoose.Types.ObjectId.isValid(user) || !mongoose.Types.ObjectId.isValid(task) ||
        !mongoose.Types.ObjectId.isValid(area)) {
      return response.status(400).json({ message: 'Valid user, task, and cafe area IDs are required' });
    }
    if (!['low', 'medium', 'high'].includes(energyLevel)) {
      return response.status(400).json({ message: 'Energy level must be low, medium, or high' });
    }

    const existingUser = await User.findById(user);
    if (!existingUser) {
      return response.status(404).json({ message: 'User not found' });
    }

    const existingTask = await Task.findById(task);
    if (!existingTask) {
      return response.status(404).json({ message: 'Task not found' });
    }
    if (String(existingTask.user) !== String(user)) {
      return response.status(400).json({ message: 'Task does not belong to this user' });
    }
    if (existingTask.status === 'completed') {
      return response.status(400).json({ message: 'Choose an unfinished task' });
    }

    const existingArea = await CafeArea.findById(area);
    if (!existingArea) {
      return response.status(404).json({ message: 'Cafe area not found' });
    }
    if (!existingArea.active) {
      return response.status(400).json({ message: 'This cafe area is unavailable' });
    }

    const activeSession = await FocusSession.findOne({ user, status: 'active' });
    if (activeSession) {
      return response.status(400).json({ message: 'Finish or cancel your active focus session first' });
    }

    const recommendation = focusRecommendation(existingTask, energyLevel);
    const session = await FocusSession.create({
      user, task, area, energyLevel,
      plannedMinutes: recommendation.plannedMinutes,
      breakMinutes: recommendation.breakMinutes,
      status: 'active',
      startedAt: new Date(),
    });

    response.status(201).json(withFocusScore(session));
  } catch (error) {
    next(error);
  }
});

// PATCH /api/focus-sessions/:id with { status, completedMinutes? }
router.patch('/:id', async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: 'Invalid focus session ID' });
    }

    const { status, completedMinutes } = request.body || {};
    if (!['completed', 'cancelled'].includes(status)) {
      return response.status(400).json({ message: 'Status must be completed or cancelled' });
    }
    if (status === 'completed' &&
        (!Number.isInteger(completedMinutes) || completedMinutes < 1 || completedMinutes > 120)) {
      return response.status(400).json({ message: 'Completed minutes must be a whole number from 1 to 120' });
    }

    const session = await FocusSession.findById(request.params.id);
    if (!session) {
      return response.status(404).json({ message: 'Focus session not found' });
    }
    if (session.status !== 'active') {
      return response.status(400).json({ message: 'Only active focus sessions can be finished or cancelled' });
    }

    session.status = status;
    session.endedAt = new Date();
    if (status === 'completed') session.completedMinutes = completedMinutes;
    await session.save();

    response.json(withFocusScore(session));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
