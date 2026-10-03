// A second booking waits until the first capacity check and save have finished.
// This queue is shared by reservations and focus sessions in this server process.
let previous = Promise.resolve();

function withSeatLock(action) {
  const current = previous.then(action);
  previous = current.catch(() => {});
  return current;
}

module.exports = withSeatLock;
