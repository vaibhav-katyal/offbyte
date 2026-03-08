import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { validateRequest } from './middleware/validation.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handleSocketEvents } from './socket/handlers.js';
import productsRoutes from './routes/products.routes.js';
import usersRoutes from './routes/users.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Database Connection
connectDatabase().then(() => {
  console.log('âœ… Database connected');
}).catch(error => {
  console.error('âŒ Database connection failed:', error);
  process.exit(1);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error Handler
app.use(errorHandler);

// Server Start
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  handleSocketEvents(io, socket);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.use('/api/products', productsRoutes);

app.use('/api/users', usersRoutes);

server.listen(PORT, () => {
  console.log(`ðŸš€ Server running on http://localhost:${PORT}`);
});