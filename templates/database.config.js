/**
 * Database Configuration
 * Centralized database connection and configuration
 */

import mongoose from 'mongoose';
import chalk from 'chalk';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/offbyt_app';

export const dbConfig = {
  uri: MONGODB_URI,
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true
  }
};

// Connection flags
let isConnected = false;

export async function connectDatabase() {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(dbConfig.uri, dbConfig.options);
    isConnected = true;
    
    mongoose.connection.on('error', (error) => {
      console.error(chalk.red('âŒ MongoDB Error:'), error.message);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn(chalk.yellow('âš ï¸  MongoDB Disconnected'));
      isConnected = false;
    });

    console.log(chalk.green('âœ… MongoDB Connected Successfully'));
    return mongoose.connection;
  } catch (error) {
    console.error(chalk.red('âŒ MongoDB Connection Failed:'), error.message);
    throw error;
  }
}

export async function disconnectDatabase() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log(chalk.yellow('ðŸ”Œ MongoDB Disconnected'));
  } catch (error) {
    console.error(chalk.red('âŒ MongoDB Disconnection Error:'), error.message);
  }
}

export function isDatabaseConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

export default { connectDatabase, disconnectDatabase, isDatabaseConnected, dbConfig };

