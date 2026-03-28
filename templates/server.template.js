import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import errorHandler from './middleware/errorHandler.js';
import requestLogger from './middleware/requestLogger.js';

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/__DB_NAME__';

// ============ MIDDLEWARE ============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());
app.use(requestLogger);

// ============ ROUTES ============
// Routes should be registered with /api prefix in __ROUTES__
// Example: app.use(`/api/users`, usersRoutes);
// 
// Frontend Configuration:
//   ✅ CORRECT:   VITE_API_URL = http://localhost:5000
//   ❌ WRONG:     VITE_API_URL = http://localhost:5000/api
// __ROUTES__

// ============ HEALTH CHECK ============
const healthHandler = (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState ? 'Connected' : 'Disconnected'
  });
};

app.get('/health', healthHandler);
app.get(`/api/health`, healthHandler);

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
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API Health: http://localhost:${PORT}/api/health\n`);
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
