const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    requestKey: { type: String, maxlength: 120 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },
        name: { type: String, required: true },
        category: { type: String, enum: ["drink", "snack"] },
        quantity: { type: Number, required: true, min: 1 },
        unitPriceCredits: { type: Number, required: true, min: 0 },
        breakMinutes: { type: Number, min: 1, max: 30 },
      },
    ],
    subtotalCredits: { type: Number, required: true, min: 0 },
    discountCredits: { type: Number, required: true, min: 0, default: 0 },
    totalCredits: { type: Number, required: true, min: 0 },
    creditsCharged: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["placed", "fulfilled", "cancelled"],
      default: "placed",
    },
  },
  { timestamps: true },
);

orderSchema.index(
  { user: 1, requestKey: 1 },
  {
    unique: true,
    partialFilterExpression: { requestKey: { $type: "string" } },
  },
);

module.exports = mongoose.model("Order", orderSchema);
