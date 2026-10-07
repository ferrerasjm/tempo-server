const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CafeArea",
      required: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "cancelled", "completed"],
      default: "active",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Reservation", reservationSchema);
