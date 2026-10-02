const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const focusRecommendation = require('../utils/focusRecommendation');

const router = express.Router();

// POST /api/focus/recommendation with { task, energyLevel }
router.post('/recommendation', async (request, response, next) => {
  try {
    const { task, energyLevel } = request.body || {};

    if (!mongoose.Types.ObjectId.isValid(task)) {
      return response.status(400).json({ message: 'Invalid task ID' });
    }
    if (!['low', 'medium', 'high'].includes(energyLevel)) {
      return response.status(400).json({ message: 'Energy level must be low, medium, or high' });
    }

    const existingTask = await Task.findById(task);
    if (!existingTask) {
      return response.status(404).json({ message: 'Task not found' });
    }
    if (existingTask.status === 'completed') {
      return response.status(400).json({ message: 'Choose an unfinished task' });
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

module.exports = router;
