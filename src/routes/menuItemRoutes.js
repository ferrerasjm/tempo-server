const express = require('express');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');

const router = express.Router();

// GET /api/menu-items?category=drink
router.get('/', async (request, response, next) => {
  try {
    const filter = {};
    if (request.query.category) {
      if (!['drink', 'snack'].includes(request.query.category)) {
        return response.status(400).json({ message: 'Category must be drink or snack' });
      }
      filter.category = request.query.category;
    }

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    response.json(items);
  } catch (error) {
    next(error);
  }
});

// GET /api/menu-items/:id
router.get('/:id', async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: 'Invalid menu item ID' });
    }

    const item = await MenuItem.findById(request.params.id);
    if (!item) {
      return response.status(404).json({ message: 'Menu item not found' });
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
