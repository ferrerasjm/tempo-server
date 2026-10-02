const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  area: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeArea', required: true },
  plannedMinutes: { type: Number, required: true, min: 15, max: 120 },
  completedMinutes: { type: Number, min: 0, max: 120, default: 0 },
  breakMinutes: { type: Number, required: true, min: 5, max: 30 },
  energyLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
  status: { type: String, enum: ['planned', 'active', 'completed', 'cancelled'], default: 'planned' },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('FocusSession', focusSessionSchema, 'focusSessions');
