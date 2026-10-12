const express = require("express");
const { randomBytes } = require("node:crypto");
const User = require("../models/User");
const AuthSession = require("../models/AuthSession");
const authenticate = require("../middleware/authenticate");
const { hashPassword, verifyPassword, tokenHash } = require("../utils/passwords");
const router = express.Router();
const attempts = new Map();
const windowMs = 15 * 60 * 1000;
const cleanup = setInterval(() => {
  for (const [ip, entry] of attempts) if (entry.until <= Date.now()) attempts.delete(ip);
}, windowMs);
cleanup.unref();

function limitAttempts(request, response, next) {
  response.set("Cache-Control", "no-store");
  const now = Date.now();
  let entry = attempts.get(request.ip);
  if (!entry || entry.until <= now) {
    entry = { count: 0, until: now + windowMs };
    attempts.set(request.ip, entry);
  }
  if (++entry.count > 20) {
    response.set("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
    return response.status(429).json({ message: "Too many attempts. Please try again in a few minutes." });
  }
  next();
}

async function startSession(user) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await AuthSession.create({ tokenHash: tokenHash(token), user: user._id, expiresAt });
  return { token, user: { _id: user._id, displayName: user.displayName, email: user.email } };
}

router.post("/signup", limitAttempts, async (request, response, next) => {
  const { displayName, email, password, confirmPassword } = request.body || {};
  if (typeof displayName !== "string" || !displayName.trim() || displayName.length > 100) {
    return response.status(400).json({ field: "name", message: "Enter a name of up to 100 characters." });
  }
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return response.status(400).json({ field: "email", message: "Enter a valid email address." });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 1024) {
    return response.status(400).json({ field: "password", message: "Use a password between 8 and 1024 characters." });
  }
  if (password !== confirmPassword) {
    return response.status(400).json({ field: "confirmPassword", message: "Passwords do not match." });
  }
  try {
    await User.create({
      displayName: displayName.trim(), email: email.trim().toLowerCase(),
      passwordHash: await hashPassword(password),
    });
    response.status(201).json({ message: "Account created successfully. Please log in." });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ field: "email", message: "An account with this email already exists. Please log in." });
    }
    next(error);
  }
});

router.post("/login", limitAttempts, async (request, response, next) => {
  const { email, password } = request.body || {};
  if (typeof email !== "string" || !email.trim() || email.length > 254 ||
      typeof password !== "string" || !password || password.length > 1024) {
    return response.status(400).json({ message: "Enter your email and password." });
  }
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!(await verifyPassword(password, user?.passwordHash))) {
      return response.status(401).json({ field: "password", message: "Email or password is incorrect." });
    }
    response.json(await startSession(user));
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, (request, response) => {
  response.set("Cache-Control", "no-store");
  response.json(request.user);
});
router.post("/logout", authenticate, async (request, response, next) => {
  try {
    await AuthSession.deleteOne({ _id: request.authSession._id });
    response.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
