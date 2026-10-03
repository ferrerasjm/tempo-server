const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Existing profiles only. This route does not authenticate a user.
router.get('/', async (request, response, next) => {
  try {
    const users = await User.find().sort({ displayName: 1 });
    response.json(users);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
