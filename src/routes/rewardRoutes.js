const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const { tempoRewards } = require('../utils/tempoRewards');
const router = express.Router();

router.get('/', async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.query.user)) return response.status(400).json({ message: 'Valid user ID is required' });
    if (!await User.findById(request.query.user)) return response.status(404).json({ message: 'User not found' });
    response.json(await tempoRewards(request.query.user));
  } catch (error) { next(error); }
});

module.exports = router;
