const { test } = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/User");
const AuthSession = require("../src/models/AuthSession");
const Task = require("../src/models/Task");
const Order = require("../src/models/Order");
const Reservation = require("../src/models/Reservation");
const FocusSession = require("../src/models/FocusSession");
const {
  hashPassword,
  verifyPassword,
  tokenHash,
} = require("../src/utils/passwords");
const app = require("../src/app");

test("signup, password login, session lifecycle, and account isolation", async (t) => {
  const passwordHash = await hashPassword("a test password");
  assert.equal(await verifyPassword("a test password", passwordHash), true);
  assert.equal(await verifyPassword("incorrect", passwordHash), false);
  assert.equal(await verifyPassword("a test password", undefined), false);
  assert.notEqual(await hashPassword("a test password"), passwordHash);

  const user = {
    _id: "0123456789abcdef01234567",
    displayName: "Test User",
    email: "test@example.com",
  };
  const foreignUser = "1123456789abcdef01234567";
  const taskId = "2123456789abcdef01234567";
  const sessions = new Map();
  const accounts = new Map([[user.email, { ...user, passwordHash }]]);
  const originals = [];
  function mock(target, key, value) {
    originals.push([target, key, target[key]]);
    target[key] = value;
  }
  mock(User, "findOne", ({ email }) => ({
    select: async () => accounts.get(email) || null,
  }));
  mock(User, "findByIdAndUpdate", async (id, update) => {
    assert.equal(
      id,
      user._id,
      "profile changes must target the authenticated user",
    );
    assert.deepEqual(update, { $set: { displayName: "Updated Name" } });
    return { ...accounts.get(user.email), ...update.$set };
  });
  mock(User, "create", async (data) => {
    if (accounts.has(data.email))
      throw Object.assign(new Error("Duplicate email"), { code: 11000 });
    const account = { _id: foreignUser, ...data };
    accounts.set(data.email, account);
    return account;
  });
  mock(AuthSession, "create", async (data) => {
    const account = [...accounts.values()].find(
      (entry) => entry._id === data.user,
    );
    const session = {
      ...data,
      _id: data.tokenHash,
      user: {
        _id: account._id,
        displayName: account.displayName,
        email: account.email,
      },
    };
    sessions.set(data.tokenHash, session);
    return session;
  });
  mock(AuthSession, "findOne", (query) => ({
    populate: async () => {
      const session = sessions.get(query.tokenHash);
      return session && session.expiresAt > query.expiresAt.$gt
        ? session
        : null;
    },
  }));
  mock(AuthSession, "deleteOne", async ({ _id }) => sessions.delete(_id));
  mock(Task, "findOne", () => ({ select: async () => null }));
  for (const model of [Order, Reservation, FocusSession]) {
    mock(model, "findOne", () => ({ select: async () => null }));
  }
  mock(Task, "find", (filter) => ({
    sort: async () => {
      assert.equal(
        filter.user,
        user._id,
        "list requests without user IDs must still be scoped",
      );
      return [];
    },
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    for (const [target, key, value] of originals) target[key] = value;
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, { token, body, method = "GET" } = {}) {
    return fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  assert.equal((await request("/tasks")).status, 401);
  assert.equal((await request("/tasks", { token: "invalid" })).status, 401);
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: user.email, password: "wrong" },
      })
    ).status,
    401,
  );
  const unknown = await request("/auth/login", {
    method: "POST",
    body: { email: "unknown@example.com", password: "wrong" },
  });
  assert.equal(unknown.status, 401);
  assert.deepEqual(await unknown.json(), {
    field: "password",
    message: "Email or password is incorrect.",
  });
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: { $ne: null }, password: "x" },
      })
    ).status,
    400,
  );

  const login = await request("/auth/login", {
    method: "POST",
    body: { email: " TEST@example.com ", password: "a test password" },
  });
  assert.equal(login.status, 200);
  const result = await login.json();
  const token = result.token;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.user, user);
  assert.ok(sessions.has(tokenHash(token)));
  assert.equal(JSON.stringify([...sessions.values()]).includes(token), false);
  assert.equal((await request("/auth/me", { token })).status, 200);
  const profiles = await request("/users", { token });
  assert.deepEqual(await profiles.json(), [user]);
  assert.equal(
    (
      await request("/users/me", {
        method: "PATCH",
        body: { displayName: "Updated Name" },
      })
    ).status,
    401,
  );
  for (const displayName of ["   ", "a".repeat(101), { $ne: null }]) {
    assert.equal(
      (
        await request("/users/me", {
          token,
          method: "PATCH",
          body: { displayName },
        })
      ).status,
      400,
    );
  }
  const updatedProfile = await request("/users/me", {
    token,
    method: "PATCH",
    body: {
      displayName: " Updated Name ",
      _id: foreignUser,
      email: "changed@example.com",
      passwordHash: "changed",
    },
  });
  assert.equal(updatedProfile.status, 200);
  assert.deepEqual(await updatedProfile.json(), {
    ...user,
    displayName: "Updated Name",
  });
  assert.equal((await request("/tasks", { token })).status, 200);
  assert.equal(
    (await request(`/tasks?user=${foreignUser}`, { token })).status,
    403,
  );
  assert.equal(
    (
      await request("/orders", {
        token,
        method: "POST",
        body: { user: foreignUser },
      })
    ).status,
    403,
  );
  assert.equal((await request(`/tasks/${taskId}`, { token })).status, 404);
  assert.equal(
    (
      await request(`/tasks/${taskId}`, {
        token,
        method: "PATCH",
        body: { title: "Other user's task" },
      })
    ).status,
    404,
  );
  assert.equal(
    (await request(`/tasks/${taskId}`, { token, method: "DELETE" })).status,
    404,
  );
  for (const path of ["orders", "reservations", "focus-sessions"]) {
    assert.equal((await request(`/${path}/${taskId}`, { token })).status, 404);
    assert.equal(
      (
        await request(`/${path}/${taskId}`, {
          token,
          method: "PATCH",
          body: { action: "stop" },
        })
      ).status,
      404,
    );
  }
  assert.equal(
    (
      await request("/focus/recommendation", {
        token,
        method: "POST",
        body: { task: taskId, energyLevel: "medium" },
      })
    ).status,
    404,
  );
  sessions.get(tokenHash(token)).expiresAt = new Date(0);
  assert.equal((await request("/auth/me", { token })).status, 401);
  sessions.get(tokenHash(token)).expiresAt = new Date(Date.now() + 60000);
  assert.equal(
    (await request("/auth/logout", { token, method: "POST" })).status,
    204,
  );
  assert.equal((await request("/auth/me", { token })).status, 401);
  const signupBody = {
    displayName: " New User ",
    email: " NEW@example.com ",
    password: "new test password",
    confirmPassword: "new test password",
  };
  for (const [field, changes] of [
    ["name", { displayName: "   " }],
    ["email", { email: "invalid" }],
    ["password", { password: "short", confirmPassword: "short" }],
    ["confirmPassword", { confirmPassword: "different" }],
  ]) {
    const invalid = await request("/auth/signup", {
      method: "POST",
      body: { ...signupBody, ...changes },
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).field, field);
  }
  const signup = await request("/auth/signup", {
    method: "POST",
    body: signupBody,
  });
  assert.equal(signup.status, 201);
  const registered = await signup.json();
  assert.deepEqual(registered, {
    message: "Account created successfully. Please log in.",
  });
  assert.equal(sessions.size, 0, "signup must not create a login session");
  assert.equal((await request("/auth/me")).status, 401);
  assert.equal(
    await verifyPassword(
      signupBody.password,
      accounts.get("new@example.com").passwordHash,
    ),
    true,
  );
  assert.equal(
    (await request("/auth/signup", { method: "POST", body: signupBody }))
      .status,
    409,
  );
  const newLogin = await request("/auth/login", {
    method: "POST",
    body: { email: "new@example.com", password: signupBody.password },
  });
  assert.equal(newLogin.status, 200);
  const loggedIn = await newLogin.json();
  assert.deepEqual(loggedIn.user, {
    _id: foreignUser,
    displayName: "New User",
    email: "new@example.com",
  });
  assert.equal(
    (await request("/auth/me", { token: loggedIn.token })).status,
    200,
  );
  let rateLimited;
  for (let attempt = 0; attempt < 21; attempt++) {
    rateLimited = await request("/auth/login", { method: "POST", body: {} });
    if (rateLimited.status === 429) break;
  }
  assert.equal(rateLimited.status, 429);
  assert.ok(Number(rateLimited.headers.get("Retry-After")) > 0);
});
