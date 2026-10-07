const mongoose = require("mongoose");

const cafeAreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    theme: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 100 },
    suggestedFocusMinutes: { type: Number, required: true, min: 15, max: 120 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CafeArea", cafeAreaSchema, "cafeAreas");
