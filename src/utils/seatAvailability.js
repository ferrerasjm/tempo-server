const Reservation = require('../models/Reservation');
const FocusSession = require('../models/FocusSession');
const { sessionEndsAt } = require('./sessionClock');

// Find the busiest point in a requested time window.
// A seat freed at 11:00 can be used by another reservation starting at 11:00.
async function getPeakReservedSeats(areaId, startsAt, endsAt) {
  const reservations = await Reservation.find({
    area: areaId,
    status: 'active',
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  });

  const changes = [];
  const sessions = await FocusSession.find({ area: areaId, status: 'active', startedAt: { $lt: endsAt } });
  for (const session of sessions) {
    const end = sessionEndsAt(session);
    if (end <= startsAt) continue;
    changes.push({ time: Math.max(session.startedAt.getTime(), startsAt.getTime()), seats: 1 });
    changes.push({ time: Math.min(end.getTime(), endsAt.getTime()), seats: -1 });
  }
  for (const reservation of reservations) {
    changes.push({ time: Math.max(reservation.startsAt.getTime(), startsAt.getTime()), seats: 1 });
    changes.push({ time: Math.min(reservation.endsAt.getTime(), endsAt.getTime()), seats: -1 });
  }

  // At the same time, process departures before arrivals.
  changes.sort((a, b) => a.time - b.time || a.seats - b.seats);

  let occupied = 0;
  let peak = 0;
  for (const change of changes) {
    occupied += change.seats;
    if (occupied > peak) peak = occupied;
  }

  return peak;
}

module.exports = getPeakReservedSeats;
