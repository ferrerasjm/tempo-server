const AuthSession = require("../models/AuthSession");
const { tokenHash } = require("../utils/passwords");

async function authenticate(request, response, next) {
  const token = request.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return response.status(401).json({ message: "Please log in to enter the cafe." });
  try {
    const session = await AuthSession.findOne({
      tokenHash: tokenHash(token), expiresAt: { $gt: new Date() },
    }).populate("user");
    if (!session?.user) {
      return response.status(401).json({ message: "Your login has expired. Please enter again." });
    }
    request.authSession = session;
    request.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
