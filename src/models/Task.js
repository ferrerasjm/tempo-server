const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  deadline: { type: Date, required: true },
  difficulty: { type: String, enum: ['low', 'medium', 'high'], required: true },
  estimatedMinutes: { type: Number, required: true, min: 15, max: 480 },
  status: { type: String, enum: ['todo', 'in_progress', 'completed'], default: 'todo' },
  completedAt: { type: Date, default: null },
  tempoCreditsEarned: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
