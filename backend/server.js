import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import errorHandler from './middleware/errorHandler.js';
import requestLogger from './middleware/requestLogger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://adityasharma5672_db_user:aditya_sharma@cctv.ua9ppeq.mongodb.net/';

// ============ MIDDLEWARE ============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());
app.use(requestLogger);

// ============ ROUTES ============
import authRoutes from './routes/auth.routes.js';
app.use('/api/auth', authRoutes);

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState ? 'Connected' : 'Disconnected'
  });
});

// ============ ERROR HANDLER ============
app.use(errorHandler);

// ============ 404 HANDLER ============
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// ============ DATABASE CONNECTION ============
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    process.exit(1);
  }
}

// ============ START SERVER ============
async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`\n🚀 Backend Server Running`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
}

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGINT', async () => {
  console.log('\n⛔ Shutting down...');
  await mongoose.disconnect();
  process.exit(0);
});

startServer().catch(err => {
  console.error(err);
  process.exit(1);
});

export default app;
