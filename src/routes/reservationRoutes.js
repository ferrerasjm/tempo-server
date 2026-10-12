const express = require("express");
const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const CafeArea = require("../models/CafeArea");
const User = require("../models/User");
const getPeakReservedSeats = require("../utils/seatAvailability");
const parseDateTime = require("../utils/parseDateTime");
const FocusSession = require("../models/FocusSession");
const { sessionEndsAt } = require("../utils/sessionClock");
const withSeatLock = require("../utils/seatLock");

const router = express.Router();

router.get("/", async (request, response, next) => {
  try {
    const filter = {};

    if (request.query.user) {
      if (!mongoose.Types.ObjectId.isValid(request.query.user)) {
        return response.status(400).json({ message: "Invalid user ID" });
      }
      filter.user = request.query.user;
    }

    if (request.query.status) {
      if (
        !["active", "cancelled", "completed"].includes(request.query.status)
      ) {
        return response
          .status(400)
          .json({ message: "Invalid reservation status" });
      }
      filter.status = request.query.status;
    }

    const reservations = await Reservation.find(filter).sort({ startsAt: 1 });
    response.json(reservations);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: "Invalid reservation ID" });
    }

    const reservation = await Reservation.findById(request.params.id);
    if (!reservation) {
      return response.status(404).json({ message: "Reservation not found" });
    }

    response.json(reservation);
  } catch (error) {
    next(error);
  }
});

router.post("/", (request, response, next) =>
  withSeatLock(async () => {
    try {
      const { user, area, startsAt, endsAt } = request.body || {};

      if (
        !mongoose.Types.ObjectId.isValid(user) ||
        !mongoose.Types.ObjectId.isValid(area)
      ) {
        return response
          .status(400)
          .json({ message: "Valid user and cafe area IDs are required" });
      }

      const start = parseDateTime(startsAt);
      const end = parseDateTime(endsAt);
      if (!start || !end || end <= start || start <= new Date()) {
        return response.status(400).json({
          message:
            "Reservation needs a future start, a later end, and a timezone on both dates",
        });
      }

      const existingUser = await User.findById(user);
      if (!existingUser) {
        return response.status(404).json({ message: "User not found" });
      }

      const existingArea = await CafeArea.findById(area);
      if (!existingArea) {
        return response.status(404).json({ message: "Cafe area not found" });
      }
      if (!existingArea.active) {
        return response
          .status(400)
          .json({ message: "This cafe area is unavailable" });
      }

      const overlapping = {
        status: "active",
        startsAt: { $lt: end },
        endsAt: { $gt: start },
      };

      const ownReservation = await Reservation.findOne({
        ...overlapping,
        user,
      });
      if (ownReservation) {
        return response
          .status(400)
          .json({ message: "You already have a reservation during this time" });
      }

      const focus = await FocusSession.findOne({ user, status: "active" });
      if (focus && focus.startedAt < end && sessionEndsAt(focus) > start) {
        return response.status(400).json({
          message: "You already have a focus session during this time",
        });
      }

      const reservedSeats = await getPeakReservedSeats(area, start, end);
      if (reservedSeats >= existingArea.capacity) {
        return response
          .status(400)
          .json({ message: "No seats remain in this cafe area for that time" });
      }

      const reservation = await Reservation.create({
        user,
        area,
        startsAt: start,
        endsAt: end,
      });
      response.status(201).json(reservation);
    } catch (error) {
      next(error);
    }
  }).catch(next),
);

router.patch("/:id", async (request, response, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(request.params.id)) {
      return response.status(400).json({ message: "Invalid reservation ID" });
    }
    if (!request.body || request.body.status !== "cancelled") {
      return response
        .status(400)
        .json({ message: "Only cancellation is supported" });
    }

    const reservation = await Reservation.findById(request.params.id);
    if (!reservation) {
      return response.status(404).json({ message: "Reservation not found" });
    }
    if (reservation.status !== "active") {
      return response
        .status(400)
        .json({ message: "Only active reservations can be cancelled" });
    }

    reservation.status = "cancelled";
    await reservation.save();
    response.json(reservation);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
