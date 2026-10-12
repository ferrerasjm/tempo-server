require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("node:readline/promises");
const { Writable } = require("node:stream");
const connectDB = require("../config/database");
const User = require("../models/User");
const AuthSession = require("../models/AuthSession");
const { hashPassword } = require("../utils/passwords");

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run set-password -- your@email.com");
  if (!process.stdin.isTTY)
    throw new Error(
      "Run this command in an interactive terminal to enter a password privately.",
    );
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, done) {
      if (!muted) process.stdout.write(chunk, encoding);
      done();
    },
  });
  const input = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  let password;
  let confirmation;
  try {
    process.stdout.write("New password (at least 8 characters): ");
    muted = true;
    password = await input.question("");
    process.stdout.write("\nConfirm password: ");
    confirmation = await input.question("");
    process.stdout.write("\n");
  } finally {
    input.close();
  }
  if (password.length < 8 || password.length > 1024)
    throw new Error("Use a password between 8 and 1024 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  await connectDB();
  const user = await User.findOne({ email });
  if (!user)
    throw new Error("Account not found. Run npm run seed first if needed.");
  user.passwordHash = await hashPassword(password);
  await user.save();
  await AuthSession.deleteMany({ user: user._id });
  console.log(
    `Password set for ${email}. Previous login sessions have been revoked.`,
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
