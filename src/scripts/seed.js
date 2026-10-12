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
  const profileEmails = ["mjferreras01@gmail.com", "nicasalvads@gmail.com"];
  const profiles = await User.find({ email: { $in: profileEmails } });
  if (reset && profiles.length) {
    const profileIds = profiles.map((profile) => profile._id);
    await Promise.all([
      Order.deleteMany({ user: { $in: profileIds } }),
      Reservation.deleteMany({ user: { $in: profileIds } }),
      FocusSession.deleteMany({ user: { $in: profileIds } }),
      Task.deleteMany({ user: { $in: profileIds } }),
    ]);
  }

  const user = await findOrCreate(
    User,
    { email: profileEmails[0] },
    {
      displayName: "Jan Matthew Ferreras",
      email: profileEmails[0],
    },
  );
  await findOrCreate(
    User,
    { email: profileEmails[1] },
    {
      displayName: "Nica Isabele T. Salvadora",
      email: profileEmails[1],
    },
  );

  const areaData = [
    {
      name: "Window View",
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
      name: "Library",
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
    const oldName =
      area.name === "Library"
        ? "Library Table"
        : area.name === "Window View"
          ? "Window Seat"
          : "";
    const existingOldArea = oldName
      ? await CafeArea.findOne({ name: oldName })
      : null;
    if (existingOldArea) {
      existingOldArea.name = area.name;
      existingOldArea.theme = area.theme;
      await existingOldArea.save();
      areas[area.name] = existingOldArea;
    } else {
      areas[area.name] = await findOrCreate(
        CafeArea,
        { name: area.name },
        area,
      );
    }
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

  await findOrCreate(
    Reservation,
    { user: user._id, area: areas["Window View"]._id, status: "active" },
    {
      user: user._id,
      area: areas["Window View"]._id,
      startsAt: hoursFromNow(1),
      endsAt: hoursFromNow(2),
      status: "active",
    },
  );

  console.log(
    `Cafe Tempo sample data is ready${reset ? " after resetting the seeded profiles" : ""}.`,
  );
}

seed()
  .catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
