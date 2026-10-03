const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['drink', 'snack'] },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCredits: { type: Number, required: true, min: 0 },
  }],
  subtotalCredits: { type: Number, required: true, min: 0 },
  discountCredits: { type: Number, required: true, min: 0, default: 0 },
  totalCredits: { type: Number, required: true, min: 0 },
  creditsCharged: { type: Boolean, default: false },
  status: { type: String, enum: ['placed', 'fulfilled', 'cancelled'], default: 'placed' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
