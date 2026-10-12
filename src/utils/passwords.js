const {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
} = require("node:crypto");
const { promisify } = require("node:util");
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, options);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const parts = typeof stored === "string" ? stored.split(":") : [];
  const valid =
    parts.length === 3 &&
    parts[0] === "scrypt" &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  const key = await derive(
    password,
    valid ? parts[1] : "0".repeat(32),
    64,
    options,
  );
  const expected = valid ? Buffer.from(parts[2], "hex") : Buffer.alloc(64);
  return timingSafeEqual(key, expected) && valid;
}

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
module.exports = { hashPassword, verifyPassword, tokenHash };
