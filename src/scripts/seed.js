require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const User = require("../models/User");
const Task = require("../models/Task");
const FocusSession = require("../models/FocusSession");
const CafeArea = require("../models/CafeArea");
const Reservation = require("../models/Reservation");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");

// Find the sample record first so running the seed again does not duplicate it.
async function findOrCreate(Model, search, data) {
  const existing = await Model.findOne(search);
  if (existing) return existing;
  return Model.create(data);
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function seed() {
  await connectDB();

  const reset = process.argv.includes("--reset");
  const demoUser = await User.findOne({ email: "demo@cafetempo.test" });
  if (reset && demoUser) {
    await Promise.all([
      Order.deleteMany({ user: demoUser._id }),
      Reservation.deleteMany({ user: demoUser._id }),
      FocusSession.deleteMany({ user: demoUser._id }),
      Task.deleteMany({ user: demoUser._id }),
    ]);
  }

  const user = await findOrCreate(
    User,
    { email: "demo@cafetempo.test" },
    { displayName: "Demo Student", email: "demo@cafetempo.test" },
  );

  const areaData = [
    {
      name: "Window Seat",
      theme: "Soft daylight and a view of the street.",
      capacity: 6,
      suggestedFocusMinutes: 50,
    },
    {
      name: "Quiet Corner",
      theme: "A calm spot for uninterrupted reading.",
      capacity: 4,
      suggestedFocusMinutes: 45,
    },
    {
      name: "Library Table",
      theme: "Room to spread out notes and books.",
      capacity: 8,
      suggestedFocusMinutes: 50,
    },
    {
      name: "Garden Patio",
      theme: "Fresh air and a gentle outdoor setting.",
      capacity: 5,
      suggestedFocusMinutes: 25,
    },
    {
      name: "Midnight Cafe",
      theme: "A cozy space for late study hours.",
      capacity: 6,
      suggestedFocusMinutes: 50,
    },
  ];

  const areas = {};
  for (const area of areaData) {
    areas[area.name] = await findOrCreate(CafeArea, { name: area.name }, area);
  }

  const menuData = [
    { name: "Cafe Latte", category: "drink", priceCredits: 30 },
    { name: "Americano", category: "drink", priceCredits: 24 },
    { name: "Cappuccino", category: "drink", priceCredits: 32 },
    { name: "Matcha Tea", category: "drink", priceCredits: 28 },
    { name: "Hot Chocolate", category: "drink", priceCredits: 26 },
    { name: "Macchiato", category: "drink", priceCredits: 34 },
    {
      name: "Fruit Tart",
      category: "snack",
      priceCredits: 24,
      breakMinutes: 15,
    },
    { name: "Egg Tart", category: "snack", priceCredits: 20, breakMinutes: 5 },
    {
      name: "Cinnamon Roll",
      category: "snack",
      priceCredits: 22,
      breakMinutes: 10,
    },
    {
      name: "Chocolate Donut",
      category: "snack",
      priceCredits: 18,
      breakMinutes: 5,
    },
    {
      name: "Blueberry Muffin",
      category: "snack",
      priceCredits: 21,
      breakMinutes: 10,
    },
    { name: "Croissant", category: "snack", priceCredits: 20, breakMinutes: 5 },
  ];

  const menuItems = {};
  for (const item of menuData) {
    menuItems[item.name] = await findOrCreate(
      MenuItem,
      { name: item.name },
      item,
    );
    if (
      item.breakMinutes &&
      menuItems[item.name].breakMinutes !== item.breakMinutes
    ) {
      menuItems[item.name].breakMinutes = item.breakMinutes;
      await menuItems[item.name].save();
    }
  }

  const legacyItems = await MenuItem.find({
    name: { $in: ["Butter Cookie", "Black Tea", "Mocha"] },
  });
  for (const legacyItem of legacyItems) {
    if (!(await Order.exists({ "items.menuItem": legacyItem._id }))) {
      await MenuItem.deleteOne({ _id: legacyItem._id });
    }
  }

  const reviewTask = await findOrCreate(
    Task,
    { user: user._id, title: "Review database relationships" },
    {
      user: user._id,
      title: "Review database relationships",
      description: "Draw the links between Cafe Tempo collections.",
      deadline: hoursFromNow(24),
      difficulty: "medium",
      estimatedMinutes: 90,
    },
  );

  await findOrCreate(
    Task,
    { user: user._id, title: "Prepare API demo" },
    {
      user: user._id,
      title: "Prepare API demo",
      description: "Practice success, validation, and missing-record cases.",
      deadline: hoursFromNow(48),
      difficulty: "high",
      estimatedMinutes: 150,
    },
  );

  const notesTask = await findOrCreate(
    Task,
    { user: user._id, title: "Outline study notes" },
    {
      user: user._id,
      title: "Outline study notes",
      deadline: hoursFromNow(72),
      difficulty: "low",
      estimatedMinutes: 45,
      status: "completed",
      completedAt: hoursFromNow(-20),
      tempoCreditsEarned: 15,
    },
  );

  await findOrCreate(
    FocusSession,
    { user: user._id, task: notesTask._id, status: "completed" },
    {
      user: user._id,
      task: notesTask._id,
      area: areas["Window Seat"]._id,
      plannedMinutes: 45,
      completedMinutes: 45,
      breakMinutes: 10,
      energyLevel: "medium",
      status: "completed",
      startedAt: hoursFromNow(-21),
      endedAt: hoursFromNow(-20.25),
      tempoCreditsEarned: 20,
      taskConfirmed: true,
      taskCompleted: true,
    },
  );

  await findOrCreate(
    FocusSession,
    { user: user._id, task: reviewTask._id, status: "completed" },
    {
      user: user._id,
      task: reviewTask._id,
      area: areas["Quiet Corner"]._id,
      plannedMinutes: 50,
      completedMinutes: 40,
      breakMinutes: 10,
      energyLevel: "high",
      status: "completed",
      startedAt: hoursFromNow(-3),
      endedAt: hoursFromNow(-2.33),
      tempoCreditsEarned: 20,
      taskConfirmed: true,
      taskCompleted: false,
    },
  );

  await findOrCreate(
    Reservation,
    { user: user._id, area: areas["Window Seat"]._id, status: "active" },
    {
      user: user._id,
      area: areas["Window Seat"]._id,
      startsAt: hoursFromNow(1),
      endsAt: hoursFromNow(2),
      status: "active",
    },
  );

  await findOrCreate(
    Order,
    { user: user._id, "items.menuItem": menuItems["Cafe Latte"]._id },
    {
      user: user._id,
      items: [
        {
          menuItem: menuItems["Cafe Latte"]._id,
          name: "Cafe Latte",
          quantity: 1,
          unitPriceCredits: 30,
        },
      ],
      subtotalCredits: 30,
      discountCredits: 0,
      totalCredits: 30,
    },
  );

  console.log(
    `Cafe Tempo sample data is ready${reset ? " after resetting the demo profile" : ""}.`,
  );
}

seed()
  .catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
