const FocusSession = require("../models/FocusSession");
const CafeArea = require("../models/CafeArea");
const Reservation = require("../models/Reservation");
const getPeakReservedSeats = require("./seatAvailability");
const withSeatLock = require("./seatLock");
const { elapsedMilliseconds } = require("./sessionClock");

function resumeRewardBreaks() {
  return withSeatLock(async () => {
    const now = new Date();
    const sessions = await FocusSession.find({
      status: "paused",
      rewardBreakEndsAt: { $ne: null, $lte: now },
    });
    for (const session of sessions) {
      const area = await CafeArea.findById(session.area);
      if (!area || !area.active) continue;
      const remaining =
        session.plannedMinutes * 60000 - elapsedMilliseconds(session, now);
      const end = new Date(now.getTime() + remaining);
      const booking = await Reservation.findOne({
        user: session.user,
        status: "active",
        startsAt: { $lt: end },
        endsAt: { $gt: now },
      });
      if (
        booking ||
        (await getPeakReservedSeats(area._id, now, end)) >= area.capacity
      )
        continue;
      session.pausedMilliseconds += now.getTime() - session.pausedAt.getTime();
      session.pausedAt = null;
      session.rewardBreakEndsAt = null;
      session.status = "active";
      await session.save();
    }
  });
}

module.exports = resumeRewardBreaks;
