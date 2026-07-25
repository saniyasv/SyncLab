import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import { testConnection } from './db/pool.js';
import { setupSocket } from './socket/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import messageRoutes from './routes/messages.js';
import fileRoutes from './routes/files.js';
import whiteboardRoutes from './routes/whiteboard.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

setupSocket(io);

// ── Middleware ──
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api', apiLimiter);

// ── Routes ──
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:roomId/messages', messageRoutes);
app.use('/api/rooms/:roomId/files', fileRoutes);
app.use('/api/rooms/:roomId/whiteboard', whiteboardRoutes);
app.use('/api/notifications', notificationRoutes);

// ── Error handling ──
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

testConnection().then(() => {
  server.listen(PORT, () => {
    console.log(`[server] CollabHub API running on port ${PORT}`);
    console.log(`[server] Socket.IO ready on port ${PORT}`);
  });
});
