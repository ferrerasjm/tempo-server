function elapsedMilliseconds(session, now = new Date()) {
  if (!session.startedAt) return 0;
  const until = session.pausedAt || session.endedAt || now;
  return Math.max(0, until.getTime() - session.startedAt.getTime() - (session.pausedMilliseconds || 0));
}

function sessionEndsAt(session) {
  return new Date(session.startedAt.getTime() + session.plannedMinutes * 60000 + (session.pausedMilliseconds || 0));
}

module.exports = { elapsedMilliseconds, sessionEndsAt };
