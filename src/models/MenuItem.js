const mongoose = require("mongoose");
const { rewardBreakMinutes } = require("../utils/rewardBreakMinutes");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, enum: ["drink", "snack"], required: true },
    priceCredits: { type: Number, required: true, min: 0 },
    breakMinutes: {
      type: Number,
      min: 1,
      max: 30,
      default: function defaultBreakMinutes() {
        return this.category === "snack"
          ? rewardBreakMinutes(this.name)
          : undefined;
      },
    },
    available: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MenuItem", menuItemSchema, "menuItems");
