const express = require("express");
const mongoose = require("mongoose");
const CafeArea = require("../models/CafeArea");
const getPeakReservedSeats = require("../utils/seatAvailability");
const parseDateTime = require("../utils/parseDateTime");

const router = express.Router();

router.get("/", async (request, response, next) => {
  try {
    const areas = await CafeArea.find().sort({ name: 1 });
    response.json(areas);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/availability", async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: "Invalid cafe area ID" });
    }

    const area = await CafeArea.findById(request.params.id);
    if (!area) {
      return response.status(404).json({ message: "Cafe area not found" });
    }

    const startsAt = parseDateTime(request.query.startsAt);
    const endsAt = parseDateTime(request.query.endsAt);

    if (!startsAt || !endsAt || endsAt <= startsAt) {
      return response.status(400).json({
        message: "Provide date-times with a timezone; end must be after start",
      });
    }

    const reservedSeats = await getPeakReservedSeats(
      area._id,
      startsAt,
      endsAt,
    );

    const remainingSeats = Math.max(0, area.capacity - reservedSeats);
    response.json({
      areaId: area._id,
      name: area.name,
      startsAt,
      endsAt,
      capacity: area.capacity,
      reservedSeats,
      remainingSeats,
      available: area.active && remainingSeats > 0,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: "Invalid cafe area ID" });
    }

    const area = await CafeArea.findById(request.params.id);
    if (!area) {
      return response.status(404).json({ message: "Cafe area not found" });
    }

    response.json(area);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
