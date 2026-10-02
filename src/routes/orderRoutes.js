const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const FocusSession = require('../models/FocusSession');
const Order = require('../models/Order');
const philippineDayNumber = require('../utils/philippineDayNumber');

const router = express.Router();

async function calculateOrder(body) {
  const { user, items } = body || {};
  if (!mongoose.Types.ObjectId.isValid(user)) {
    return { error: { status: 400, message: 'Valid user ID is required' } };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: { status: 400, message: 'Choose at least one menu item' } };
  }

  const existingUser = await User.findById(user);
  if (!existingUser) {
    return { error: { status: 404, message: 'User not found' } };
  }

  const orderItems = [];
  const seenIds = new Set();
  let subtotalCredits = 0;
  for (const entry of items) {
    if (!entry || !mongoose.Types.ObjectId.isValid(entry.menuItem) ||
        !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 20) {
      return { error: { status: 400, message: 'Each item needs a valid menu item ID and quantity from 1 to 20' } };
    }

    const itemId = String(entry.menuItem);
    if (seenIds.has(itemId)) {
      return { error: { status: 400, message: 'List each menu item only once' } };
    }
    seenIds.add(itemId);

    const menuItem = await MenuItem.findById(itemId);
    if (!menuItem) {
      return { error: { status: 404, message: 'Menu item not found' } };
    }
    if (!menuItem.available) {
      return { error: { status: 400, message: `${menuItem.name} is unavailable` } };
    }

    orderItems.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      quantity: entry.quantity,
      unitPriceCredits: menuItem.priceCredits,
    });
    subtotalCredits += menuItem.priceCredits * entry.quantity;
  }

  const sessions = await FocusSession.find({ user, status: 'completed' });
  const today = philippineDayNumber(new Date());
  // A completed focus session today earns 10% off, rounded to whole credits.
  const focusDiscountApplied = sessions.some(session =>
    session.endedAt && philippineDayNumber(session.endedAt) === today
  );
  const discountCredits = focusDiscountApplied ? Math.round(subtotalCredits * 0.1) : 0;

  return {
    result: {
      user: existingUser._id,
      items: orderItems,
      subtotalCredits,
      discountCredits,
      totalCredits: subtotalCredits - discountCredits,
      focusDiscountApplied,
    },
  };
}

// GET /api/orders?user=<id>
router.get('/', async (request, response, next) => {
  try {
    const filter = {};
    if (request.query.user) {
      if (!mongoose.Types.ObjectId.isValid(request.query.user)) {
        return response.status(400).json({ message: 'Invalid user ID' });
      }
      filter.user = request.query.user;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    response.json(orders);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/calculate with { user, items: [{ menuItem, quantity }] }
router.post('/calculate', async (request, response, next) => {
  try {
    const calculation = await calculateOrder(request.body);
    if (calculation.error) {
      return response.status(calculation.error.status).json({ message: calculation.error.message });
    }
    response.json(calculation.result);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id
router.get('/:id', async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: 'Invalid order ID' });
    }

    const order = await Order.findById(request.params.id);
    if (!order) {
      return response.status(404).json({ message: 'Order not found' });
    }

    response.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders with { user, items: [{ menuItem, quantity }] }
router.post('/', async (request, response, next) => {
  try {
    const calculation = await calculateOrder(request.body);
    if (calculation.error) {
      return response.status(calculation.error.status).json({ message: calculation.error.message });
    }

    const order = await Order.create(calculation.result);
    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id with { status: 'cancelled' }
router.patch('/:id', async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: 'Invalid order ID' });
    }
    if (!request.body || request.body.status !== 'cancelled') {
      return response.status(400).json({ message: 'Only cancellation is supported' });
    }

    const order = await Order.findById(request.params.id);
    if (!order) {
      return response.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'placed') {
      return response.status(400).json({ message: 'Only placed orders can be cancelled' });
    }

    order.status = 'cancelled';
    await order.save();
    response.json(order);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
