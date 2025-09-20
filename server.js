const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./models/database');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const friendRoutes = require('./routes/friends');
const { verifyToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/friends', friendRoutes);

// Initialize database
initDatabase();

// Socket.IO connection handling
const activeUsers = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-user', (userData) => {
    activeUsers.set(socket.id, {
      ...userData,
      socketId: socket.id
    });
    socket.broadcast.emit('user-online', userData);
  });

  socket.on('join-room', ({ roomId, userInfo }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userInfo
    });

    // Send existing users in room
    const roomUsers = Array.from(rooms.get(roomId))
      .filter(id => id !== socket.id)
      .map(id => ({ socketId: id }));
    
    socket.emit('existing-users', roomUsers);
  });

  socket.on('offer', ({ offer, targetSocketId }) => {
    socket.to(targetSocketId).emit('offer', {
      offer,
      callerSocketId: socket.id
    });
  });

  socket.on('answer', ({ answer, callerSocketId }) => {
    socket.to(callerSocketId).emit('answer', {
      answer,
      answererSocketId: socket.id
    });
  });

  socket.on('ice-candidate', ({ candidate, targetSocketId }) => {
    socket.to(targetSocketId).emit('ice-candidate', {
      candidate,
      senderSocketId: socket.id
    });
  });

  socket.on('chat-message', ({ roomId, message, sender }) => {
    socket.to(roomId).emit('chat-message', {
      message,
      sender,
      timestamp: Date.now()
    });
  });

  socket.on('toggle-video', ({ roomId, enabled }) => {
    socket.to(roomId).emit('user-video-toggled', {
      socketId: socket.id,
      enabled
    });
  });

  socket.on('toggle-audio', ({ roomId, enabled }) => {
    socket.to(roomId).emit('user-audio-toggled', {
      socketId: socket.id,
      enabled
    });
  });

  socket.on('screen-share', ({ roomId, enabled }) => {
    socket.to(roomId).emit('user-screen-share', {
      socketId: socket.id,
      enabled
    });
  });

  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      socket.to(roomId).emit('user-left', socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from active users
    const userData = activeUsers.get(socket.id);
    if (userData) {
      socket.broadcast.emit('user-offline', userData);
      activeUsers.delete(socket.id);
    }

    // Remove from all rooms
    for (let [roomId, roomUsers] of rooms.entries()) {
      if (roomUsers.has(socket.id)) {
        roomUsers.delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`StudyHub server running on port ${PORT}`);
  console.log(`Access your app at: http://localhost:${PORT}`);
});
 
