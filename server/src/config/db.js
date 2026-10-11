import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB() {
  await mongoose.connect(config.mongodbUri);
  console.log('MongoDB connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export function isDbConnected() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
