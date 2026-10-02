const mongoose = require('mongoose');

async function connectDB() {
  if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('USERNAME:PASSWORD@CLUSTER')) {
    throw new Error('Set MONGO_URI in server/.env before starting the API.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

module.exports = connectDB;
