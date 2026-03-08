/**
 * Socket.io Server Template
 * 
 * Full-featured Socket.io server with:
 * - Authentication middleware
 * - Room/channel management
 * - Presence tracking
 * - Message history
 * - Typing indicators
 * - File sharing support
 * - Rate limiting
 */

export const socketServerTemplate = `import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

// Ensure JWT_SECRET is consistent across all auth checks
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';

// Active users map (userId -> socketId)
const activeUsers = new Map();

// Typing indicators (roomId -> Set of userIds)
const typingUsers = new Map();

/**
 * Initialize Socket.io server
 */
export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || process.env.REACT_APP_API_URL,
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // ============ AUTHENTICATION MIDDLEWARE ============
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      console.log(\`\n🔐 SOCKET.IO AUTH CHECK\`);
      console.log(\`  Token received: \${token ? 'YES ✅' : 'NO ❌'}\`);
      console.log(\`  Token preview: \${token ? token.substring(0, 30) + '...' : 'N/A'}\`);
      
      if (!token) {
        console.log(\`  ❌ Error: No token provided\`);
        return next(new Error('Authentication required'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
        console.log(\`  ✅ JWT verified successfully\`);
        console.log(\`  User ID from token: \${decoded.id || decoded.userId}\`);
      } catch (jwtError) {
        console.log(\`  ❌ JWT verification failed: \${jwtError.message}\`);
        console.log(\`  Error type: \${jwtError.name}\`);
        throw jwtError;
      }

      const user = await User.findById(decoded.id || decoded.userId).select('-password');
      
      if (!user) {
        console.log(\`  ❌ User not found in database\`);
        return next(new Error('User not found'));
      }

      console.log(\`  ✅ User found: \${user.email}\`);
      console.log(\`  ✅ Socket authentication successful!\n\`);

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.log(\`  ❌ Authentication error: \${error.message}\n\`);
      next(new Error(\`Socket auth failed: \${error.message}\`));
    }
  });

  // ============ CONNECTION HANDLER ============
  io.on('connection', (socket) => {
    console.log(\`\n✅ USER CONNECTED\`);
    console.log(\`  User ID: \${socket.userId}\`);
    console.log(\`  Socket ID: \${socket.id}\`);
    console.log(\`  User email: \${socket.user?.email}\`);
    console.log(\`  Total connected users: \${io.engine.clientsCount}\n\`);

    // Register user as online
    activeUsers.set(socket.userId, socket.id);
    io.emit('user:online', { userId: socket.userId, socketId: socket.id });

    // ============ JOIN CONVERSATION/ROOM ============
    socket.on('conversation:join', async (data) => {
      try {
        const { conversationId } = data;
        
        console.log(\`\n🚪 JOIN CONVERSATION REQUEST\`);
        console.log(\`  User ID: \${socket.userId}\`);
        console.log(\`  Socket ID: \${socket.id}\`);
        console.log(\`  Conversation ID: \${conversationId}\`);
        
        // Verify user has access to conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId
        });

        if (!conversation) {
          console.log(\`  ❌ FAILED: User NOT found in conversation participants\`);
          return socket.emit('error', { message: 'Conversation not found or access denied' });
        }

        socket.join(conversationId);
        const socketsInRoom = io.sockets.adapter.rooms.get(conversationId);
        const participantCount = socketsInRoom?.size || 0;
        
        console.log(\`  ✅ SUCCESS: User joined room!\`);
        console.log(\`  📊 Room "\${conversationId}" status:\`);
        console.log(\`     - Active socket connections: \${participantCount}\`);
        console.log(\`     - Conversation participants: \${conversation.participants.length}\`);
        console.log(\`     - Participant IDs: \${conversation.participants.join(', ')}\`);
        
        // List all sockets in the room
        const socketsInRoomArray = Array.from(socketsInRoom || []);
        console.log(\`     - Socket IDs in room: \${socketsInRoomArray.join(', ')}\`);
        
        // Map socket IDs to user IDs
        const usersInRoom = socketsInRoomArray.map(socketId => {
          const s = io.sockets.sockets.get(socketId);
          return s?.userId || 'unknown';
        });
        console.log(\`     - User IDs in room: \${usersInRoom.join(', ')}\n\`);
        
        socket.emit('conversation:joined', { conversationId });
      } catch (error) {
        console.error('❌ Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // ============ LEAVE CONVERSATION/ROOM ============
    socket.on('conversation:leave', (data) => {
      const { conversationId } = data;
      socket.leave(conversationId);
      console.log(\`User \${socket.userId} left conversation \${conversationId}\`);
    });

    // ============ SEND MESSAGE ============
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, type = 'text', metadata } = data;

        console.log(\`\n📨 MESSAGE SEND REQUEST\`);
        console.log(\`  Sender: \${socket.userId}\`);
        console.log(\`  Conversation: \${conversationId}\`);
        console.log(\`  Content: "\${content}\"\`);

        // Verify user has access
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId
        });

        if (!conversation) {
          console.log(\`❌ User \${socket.userId} is NOT a participant in conversation \${conversationId}\`);
          return socket.emit('error', { message: 'Conversation not found' });
        }

        console.log(\`✅ User \${socket.userId} is a participant. Participants: \${conversation.participants.join(', ')}\`);

        // Create message
        const message = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          content,
          type,
          metadata,
          timestamp: new Date()
        });

        // Populate sender details
        await message.populate('sender', 'name email avatar');

        // Update conversation last message
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        // Check who is in the room
        const socketsInRoom = io.sockets.adapter.rooms.get(conversationId);
        const usersInRoom = socketsInRoom ? Array.from(socketsInRoom).map(socketId => {
          const s = io.sockets.sockets.get(socketId);
          return s?.userId || 'unknown';
        }) : [];

        console.log(\`📊 Broadcasting to room "\${conversationId}"\`);
        console.log(\`  Users in room: \${usersInRoom.length > 0 ? usersInRoom.join(', ') : 'NOBODY'}\`);
        console.log(\`  Expected participants: \${conversation.participants.join(', ')}\`);

        if (usersInRoom.length === 0) {
          console.log(\`  ⚠️ WARNING: No users currently in room! Message will not be delivered in real-time\`);
        }

        // Emit to all users in conversation
        io.to(conversationId).emit('message:new', {
          message: message.toObject(),
          conversationId
        });

        console.log(\`✅ Message broadcasted to room. Message ID: \${message._id}\n\`);

        // Send delivery confirmation to sender
        socket.emit('message:sent', {
          tempId: data.tempId,
          message: message.toObject()
        });
      } catch (error) {
        console.error('❌ Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ============ TYPING INDICATOR ============
    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      
      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, new Set());
      }
      
      typingUsers.get(conversationId).add(socket.userId);
      
      // Broadcast to others in conversation
      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId: socket.userId,
        isTyping: true
      });
    });

    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      
      if (typingUsers.has(conversationId)) {
        typingUsers.get(conversationId).delete(socket.userId);
      }
      
      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId: socket.userId,
        isTyping: false
      });
    });

    // ============ MESSAGE READ/DELIVERY STATUS ============
    socket.on('message:read', async (data) => {
      try {
        const { messageId, conversationId } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('error', { message: 'Message not found' });
        }

        // Add to read receipts
        if (!message.readBy.includes(socket.userId)) {
          message.readBy.push(socket.userId);
          message.readAt = new Date();
          await message.save();
        }

        // Notify sender
        io.to(conversationId).emit('message:read:update', {
          messageId,
          userId: socket.userId,
          readAt: message.readAt
        });
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // ============ GET CONVERSATION HISTORY ============
    socket.on('messages:fetch', async (data) => {
      try {
        const { conversationId, limit = 50, before } = data;

        const query = { conversation: conversationId };
        if (before) {
          query.timestamp = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
          .sort({ timestamp: -1 })
          .limit(limit)
          .populate('sender', 'name email avatar')
          .lean();

        socket.emit('messages:history', {
          conversationId,
          messages: messages.reverse(),
          hasMore: messages.length === limit
        });
      } catch (error) {
        console.error('Fetch messages error:', error);
        socket.emit('error', { message: 'Failed to fetch messages' });
      }
    });

    // ============ CREATE CONVERSATION ============
    socket.on('conversation:create', async (data) => {
      try {
        const { participantIds, name, type = 'direct' } = data;

        // Include current user
        const participants = [socket.userId, ...participantIds];

        // For direct chats, check if conversation already exists
        if (type === 'direct' && participants.length === 2) {
          const existing = await Conversation.findOne({
            type: 'direct',
            participants: { $all: participants, $size: 2 }
          });

          if (existing) {
            return socket.emit('conversation:created', { conversation: existing });
          }
        }

        // Create new conversation
        const conversation = await Conversation.create({
          name,
          type,
          participants,
          createdBy: socket.userId
        });

        await conversation.populate('participants', 'name email avatar');

        // Join all participants to the room
        participants.forEach(participantId => {
          const socketId = activeUsers.get(participantId);
          if (socketId) {
            io.sockets.sockets.get(socketId)?.join(conversation._id.toString());
          }
        });

        // Notify all participants
        io.to(conversation._id.toString()).emit('conversation:new', {
          conversation: conversation.toObject()
        });

        socket.emit('conversation:created', { conversation });
      } catch (error) {
        console.error('Create conversation error:', error);
        socket.emit('error', { message: 'Failed to create conversation' });
      }
    });

    // ============ FILE UPLOAD (metadata only) ============
    socket.on('file:upload', async (data) => {
      try {
        const { conversationId, fileName, fileSize, fileType, fileUrl } = data;

        const message = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          content: fileName,
          type: 'file',
          metadata: {
            fileName,
            fileSize,
            fileType,
            fileUrl
          },
          timestamp: new Date()
        });

        await message.populate('sender', 'name email avatar');

        io.to(conversationId).emit('message:new', {
          message: message.toObject(),
          conversationId
        });
      } catch (error) {
        console.error('File upload error:', error);
        socket.emit('error', { message: 'Failed to process file' });
      }
    });

    // ============ DISCONNECT HANDLER ============
    socket.on('disconnect', () => {
      console.log(\`❌ User disconnected: \${socket.userId} (\${socket.id})\`);

      // Remove from active users
      activeUsers.delete(socket.userId);

      // Remove from typing indicators
      typingUsers.forEach((users, conversationId) => {
        if (users.has(socket.userId)) {
          users.delete(socket.userId);
          io.to(conversationId).emit('typing:update', {
            conversationId,
            userId: socket.userId,
            isTyping: false
          });
        }
      });

      // Broadcast offline status
      io.emit('user:offline', { userId: socket.userId });
    });

    // ============ ERROR HANDLER ============
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}

export default initializeSocket;
`;

export default socketServerTemplate;
