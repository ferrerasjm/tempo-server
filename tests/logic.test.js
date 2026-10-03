const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Session = require('../src/models/FocusSession');
const Task = require('../src/models/Task');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Area = require('../src/models/CafeArea');

const ids = { user: '507f1f77bcf86cd799439011', task: '507f1f77bcf86cd799439012', session: '507f1f77bcf86cd799439013', area: '507f1f77bcf86cd799439014', other: '507f1f77bcf86cd799439015' };

// Exercise actual Express routes and Mongoose validation without using Atlas.
async function check(run) {
  const originals = [];
  const stub = (model, name, replacement) => {
    originals.push([model, name, model[name]]);
    model[name] = replacement;
  };
  const app = express();
  app.use(express.json());
  app.use('/sessions', require('../src/routes/focusSessionRoutes'));
  app.use('/tasks', require('../src/routes/taskRoutes'));
  app.use('/orders', require('../src/routes/orderRoutes'));
  app.use(require('../src/middleware/errorHandler'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = async (path, body, method = 'PATCH') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try { await run(stub, request); }
  finally {
    for (const [model, name, original] of originals.reverse()) model[name] = original;
    await new Promise(resolve => server.close(resolve));
  }
}

function session(minutesAgo) {
  const doc = new Session({ _id: ids.session, user: ids.user, task: ids.task, area: ids.area, plannedMinutes: 25, breakMinutes: 5, energyLevel: 'medium', status: 'active', startedAt: new Date(Date.now() - minutesAgo * 60000) });
  doc.save = async () => doc;
  return doc;
}

test('manual completion uses elapsed time and never exceeds planned minutes', async () => check(async (stub, request) => {
  const doc = session(2);
  stub(Session, 'findById', async () => doc);
  let result = await request('/sessions/' + ids.session, { status: 'completed', completedMinutes: 120 });
  assert.equal(result.status, 200);
  assert.equal(result.body.completedMinutes, 2);
  assert.equal(result.body.focusScore, 8);
  const full = session(30);
  stub(Session, 'findById', async () => full);
  stub(Task, 'updateOne', async () => ({}));
  result = await request('/sessions/' + ids.session, { status: 'completed', completedMinutes: 120 });
  assert.equal(result.body.completedMinutes, 25);
  assert.equal(result.body.focusScore, 100);
  assert.equal(result.body.tempoCreditsEarned, 20);
}));

test('zero elapsed minutes cancel and cannot inflate statistics', async () => check(async (stub, request) => {
  stub(Session, 'findById', async () => session(0));
  const result = await request('/sessions/' + ids.session, { status: 'completed', completedMinutes: 120 });
  assert.equal(result.body.status, 'cancelled');
  assert.equal(result.body.completedMinutes, 0);
}));

test('task confirmation retries after a failure and can reopen an unfinished task', async () => check(async (stub, request) => {
  const doc = session(25); doc.status = 'completed'; doc.completedMinutes = 25;
  const task = new Task({ user: ids.user, title: 'Report', deadline: new Date(), difficulty: 'medium', estimatedMinutes: 25, status: 'completed' });
  let saves = 0;
  task.save = async () => { saves++; if (saves === 1) throw new Error('Temporary test failure'); return task; };
  stub(Session, 'findById', async () => doc);
  stub(Task, 'findById', async () => task);
  let result = await request('/sessions/' + ids.session, { action: 'confirm_task', taskCompleted: false });
  assert.equal(result.status, 500); assert.equal(doc.taskConfirmed, false);
  result = await request('/sessions/' + ids.session, { action: 'confirm_task', taskCompleted: false });
  assert.equal(result.status, 200); assert.equal(task.status, 'in_progress');
  assert.equal(result.body.taskConfirmed, true); assert.equal(result.body.taskCompleted, false);
  await request('/sessions/' + ids.session, { action: 'confirm_task', taskCompleted: true });
  assert.equal(saves, 2); assert.equal(doc.taskCompleted, false);
}));

test('paused space selection persists without resuming its clock', async () => check(async (stub, request) => {
  const doc = session(2); doc.status = 'paused'; doc.pausedAt = new Date();
  stub(Session, 'findById', async () => doc);
  stub(Area, 'findById', async () => ({ active: true }));
  const result = await request('/sessions/' + ids.session, { action: 'move', area: ids.other });
  assert.equal(result.status, 200); assert.equal(result.body.area, ids.other);
  assert.equal(result.body.status, 'paused'); assert.ok(result.body.pausedAt);
}));

test('duplicate create requests return saved records before creating or spending again', async () => check(async (stub, request) => {
  const saved = session(25); saved.requestKey = 'same-request'; saved.status = 'completed';
  stub(Session, 'findOne', async () => saved);
  stub(Task, 'findOne', async () => ({ _id: ids.task }));
  stub(Order, 'findOne', async () => ({ _id: ids.other, totalCredits: 27 }));
  stub(User, 'findById', () => { throw new Error('Replay should not create again'); });
  assert.equal((await request('/sessions', { user: ids.user, task: ids.task, area: ids.area, energyLevel: 'medium', requestKey: 'same-request' }, 'POST')).status, 200);
  assert.equal((await request('/tasks', { user: ids.user, requestKey: 'same-request' }, 'POST')).status, 200);
  assert.equal((await request('/orders', { user: ids.user, requestKey: 'same-request' }, 'POST')).status, 200);
}));

test('task schema rejects long text and fractional estimated minutes', async () => {
  const doc = new Task({ user: ids.user, title: 'x'.repeat(121), description: 'x'.repeat(1001), deadline: new Date(), difficulty: 'medium', estimatedMinutes: 25.5 });
  await assert.rejects(doc.validate(), error => Boolean(error.errors.title && error.errors.description && error.errors.estimatedMinutes));
});
