const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  category: { type: String, enum: ['drink', 'snack'], required: true },
  priceCredits: { type: Number, required: true, min: 0 },
  available: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema, 'menuItems');
