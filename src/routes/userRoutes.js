const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.get("/", (request, response) => {
  response.json([request.user]);
});

router.patch("/me", async (request, response, next) => {
  const { displayName } = request.body || {};
  if (
    typeof displayName !== "string" ||
    !displayName.trim() ||
    displayName.trim().length > 100
  ) {
    return response
      .status(400)
      .json({ message: "Enter a name of up to 100 characters." });
  }
  try {
    const user = await User.findByIdAndUpdate(
      request.user._id,
      { $set: { displayName: displayName.trim() } },
      { new: true, runValidators: true },
    );
    if (!user)
      return response.status(404).json({ message: "Profile not found." });
    response.json({
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
