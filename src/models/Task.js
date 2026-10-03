const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  requestKey: { type: String, maxlength: 120 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  deadline: { type: Date, required: true },
  difficulty: { type: String, enum: ['low', 'medium', 'high'], required: true },
  estimatedMinutes: { type: Number, required: true, min: 15, max: 480, validate: { validator: Number.isInteger, message: 'Use whole minutes' } },
  status: { type: String, enum: ['todo', 'in_progress', 'completed'], default: 'todo' },
  completedAt: { type: Date, default: null },
  tempoCreditsEarned: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

taskSchema.index({ user: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } });

module.exports = mongoose.model('Task', taskSchema);
