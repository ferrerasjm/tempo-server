const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const MenuItem = require("../models/MenuItem");
const FocusSession = require("../models/FocusSession");
const Order = require("../models/Order");
const philippineDayNumber = require("../utils/philippineDayNumber");

const withSeatLock = require("../utils/seatLock");
const { tempoRewards } = require("../utils/tempoRewards");
const { rewardBreakMinutes } = require("../utils/rewardBreakMinutes");
const router = express.Router();

async function calculateOrder(body) {
  const { user, items } = body || {};
  if (!mongoose.Types.ObjectId.isValid(user)) {
    return { error: { status: 400, message: "Valid user ID is required" } };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: { status: 400, message: "Choose at least one menu item" } };
  }

  const existingUser = await User.findById(user);
  if (!existingUser) {
    return { error: { status: 404, message: "User not found" } };
  }

  const orderItems = [];
  const seenIds = new Set();
  let subtotalCredits = 0;
  let pastryQuantity = 0;
  for (const entry of items) {
    if (
      !entry ||
      !mongoose.Types.ObjectId.isValid(entry.menuItem) ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > 20
    ) {
      return {
        error: {
          status: 400,
          message:
            "Each item needs a valid menu item ID and quantity from 1 to 20",
        },
      };
    }

    const itemId = String(entry.menuItem);
    if (seenIds.has(itemId)) {
      return {
        error: { status: 400, message: "List each menu item only once" },
      };
    }
    seenIds.add(itemId);

    const menuItem = await MenuItem.findById(itemId);
    if (!menuItem) {
      return { error: { status: 404, message: "Menu item not found" } };
    }
    if (!menuItem.available) {
      return {
        error: { status: 400, message: `${menuItem.name} is unavailable` },
      };
    }

    if (menuItem.category === "snack") pastryQuantity += entry.quantity;
    if (pastryQuantity > 1) {
      return {
        error: { status: 400, message: "Choose one pastry at a time." },
      };
    }

    orderItems.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      category: menuItem.category,
      quantity: entry.quantity,
      unitPriceCredits: menuItem.priceCredits,
      breakMinutes:
        menuItem.category === "snack"
          ? menuItem.breakMinutes || rewardBreakMinutes(menuItem.name)
          : undefined,
    });
    subtotalCredits += menuItem.priceCredits * entry.quantity;
  }

  const sessions = await FocusSession.find({ user, status: "completed" });
  const today = philippineDayNumber(new Date());
  // A completed focus session today earns 10% off, rounded to whole credits.
  const focusDiscountApplied = sessions.some(
    (session) =>
      session.endedAt && philippineDayNumber(session.endedAt) === today,
  );
  const discountCredits = focusDiscountApplied
    ? Math.round(subtotalCredits * 0.1)
    : 0;

  const rewards = await tempoRewards(user);
  if (
    pastryQuantity &&
    rewards.items.some((item) => item.category === "snack")
  ) {
    return {
      error: {
        status: 400,
        message: "Use your current pastry before buying another.",
      },
    };
  }
  return {
    result: {
      user: existingUser._id,
      items: orderItems,
      subtotalCredits,
      discountCredits,
      totalCredits: subtotalCredits - discountCredits,
      focusDiscountApplied,
      availableCredits: rewards.balance,
      canAfford: rewards.balance >= subtotalCredits - discountCredits,
    },
  };
}

router.get("/", async (request, response, next) => {
  try {
    const filter = {};
    if (request.query.user) {
      if (!mongoose.Types.ObjectId.isValid(request.query.user)) {
        return response.status(400).json({ message: "Invalid user ID" });
      }
      filter.user = request.query.user;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    const usedOrderIds = await FocusSession.distinct("rewardBreaks.order", {
      "rewardBreaks.order": { $in: orders.map((order) => order._id) },
    });
    const used = new Set(usedOrderIds.map(String));
    response.json(
      orders.map((order) => ({
        ...order.toObject(),
        canCancel: order.status === "placed" && !used.has(String(order._id)),
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/calculate", async (request, response, next) => {
  try {
    const calculation = await calculateOrder(request.body);
    if (calculation.error) {
      return response
        .status(calculation.error.status)
        .json({ message: calculation.error.message });
    }
    response.json(calculation.result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findById(request.params.id);
    if (!order) {
      return response.status(404).json({ message: "Order not found" });
    }

    response.json(order);
  } catch (error) {
    next(error);
  }
});

router.post("/", (request, response, next) =>
  withSeatLock(async () => {
    try {
      const requestKey = request.body?.requestKey;
      if (requestKey !== undefined) {
        if (
          typeof requestKey !== "string" ||
          !requestKey ||
          requestKey.length > 120
        )
          return response.status(400).json({ message: "Invalid request key" });
        if (!mongoose.Types.ObjectId.isValid(request.body.user))
          return response.status(400).json({ message: "Invalid user ID" });
        const saved = await Order.findOne({
          user: request.body.user,
          requestKey,
        });
        if (saved) return response.json(saved);
      }
      const calculation = await calculateOrder(request.body);
      if (calculation.error) {
        return response
          .status(calculation.error.status)
          .json({ message: calculation.error.message });
      }

      if (!calculation.result.canAfford)
        return response.status(400).json({
          message: "Not enough Tempo Credits. Complete a mission to earn more.",
        });
      const order = await Order.create({
        ...calculation.result,
        creditsCharged: true,
        requestKey,
      });
      response.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }).catch(next),
);

router.patch("/:id", (request, response, next) =>
  withSeatLock(async () => {
    try {
      if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
        return response.status(400).json({ message: "Invalid order ID" });
      }
      if (!request.body || request.body.status !== "cancelled") {
        return response
          .status(400)
          .json({ message: "Only cancellation is supported" });
      }

      const order = await Order.findById(request.params.id);
      if (!order) {
        return response.status(404).json({ message: "Order not found" });
      }
      if (order.status !== "placed") {
        return response
          .status(400)
          .json({ message: "Only placed orders can be cancelled" });
      }

      const used = await FocusSession.findOne({
        "rewardBreaks.order": order._id,
      });
      if (used)
        return response.status(400).json({
          message:
            "An item from this order has already been used. It cannot be refunded.",
        });
      order.status = "cancelled";
      await order.save();
      response.json(order);
    } catch (error) {
      next(error);
    }
  }).catch(next),
);

module.exports = router;
