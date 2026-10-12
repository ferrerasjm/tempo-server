let previous = Promise.resolve();

function withSeatLock(action) {
  const current = previous.then(action);
  previous = current.catch(() => {});
  return current;
}

module.exports = withSeatLock;
