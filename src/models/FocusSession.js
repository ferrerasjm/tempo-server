const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema({
  requestKey: { type: String, maxlength: 120 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  taskCompleted: { type: Boolean },
  taskConfirmed: { type: Boolean, default: false },
  taskTitle: { type: String, trim: true, maxlength: 120, default: '' },
  area: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeArea', required: true },
  plannedMinutes: { type: Number, required: true, min: 15, max: 120 },
  completedMinutes: { type: Number, min: 0, max: 120, default: 0 },
  breakMinutes: { type: Number, required: true, min: 5, max: 30 },
  energyLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
  drink: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
  drinkName: { type: String, default: '' },
  drinkSize: { type: String, enum: ['', 'tall', 'grande', 'venti'], default: '' },
  sessionLabel: { type: String, trim: true, maxlength: 80, default: '' },
  status: { type: String, enum: ['planned', 'active', 'paused', 'completed', 'cancelled'], default: 'planned' },
  startedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  pausedMilliseconds: { type: Number, min: 0, default: 0 },
  tempoCreditsEarned: { type: Number, min: 0, default: 0 },
  rewardBreakEndsAt: { type: Date, default: null },
  rewardBreaks: [{
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
  }],
  endedAt: { type: Date, default: null },
}, { timestamps: true });

focusSessionSchema.index({ user: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } });

module.exports = mongoose.model('FocusSession', focusSessionSchema, 'focusSessions');
