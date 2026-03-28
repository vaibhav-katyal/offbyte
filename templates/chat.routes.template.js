/**
 * Chat Routes Template
 * REST API endpoints for chat functionality
 */

export const chatRoutesTemplate = `import express from 'express';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============ CONVERSATIONS ============

/**
 * GET /api/chat/conversations
 * Get all conversations for current user
 */
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.findByUser(req.user.id)
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name email' }
      })
      .lean();

    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
});

/**
 * GET /api/chat/conversations/:id
 * Get single conversation details
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user.id
    })
      .populate('participants', 'name email avatar')
      .populate('admins', 'name email')
      .lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation'
    });
  }
});

/**
 * POST /api/chat/conversations
 * Create new conversation
 */
router.post('/conversations', async (req, res) => {
  try {
    const { participantIds, name, type = 'direct' } = req.body;

    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({
        success: false,
        message: 'participantIds array is required'
      });
    }

    // Include current user
    const participants = [req.user.id, ...participantIds];

    // For direct chats, check if exists
    if (type === 'direct' && participants.length === 2) {
      const existing = await Conversation.findDirectConversation(
        participants[0],
        participants[1]
      );

      if (existing) {
        return res.json({
          success: true,
          data: existing,
          isExisting: true
        });
      }
    }

    // Create new conversation
    const conversation = await Conversation.create({
      name,
      type,
      participants,
      createdBy: req.user.id,
      admins: type === 'group' ? [req.user.id] : []
    });

    await conversation.populate('participants', 'name email avatar');

    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation'
    });
  }
});

/**
 * PUT /api/chat/conversations/:id
 * Update conversation (name, settings, etc.)
 */
router.put('/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Only admins can update group conversations
    if (conversation.type === 'group' && !conversation.isAdmin(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update group conversations'
      });
    }

    const { name, description, avatar, settings } = req.body;

    if (name) conversation.name = name;
    if (description) conversation.description = description;
    if (avatar) conversation.avatar = avatar;
    if (settings) conversation.settings = { ...conversation.settings, ...settings };

    await conversation.save();

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation'
    });
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete/leave conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // For direct chats, just remove the user
    if (conversation.type === 'direct') {
      await conversation.removeParticipant(req.user.id);
    } else {
      // For groups, if creator, delete. Otherwise, just leave.
      if (conversation.createdBy.toString() === req.user.id) {
        conversation.isActive = false;
        await conversation.save();
      } else {
        await conversation.removeParticipant(req.user.id);
      }
    }

    res.json({
      success: true,
      message: 'Left conversation successfully'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation'
    });
  }
});

// ============ MESSAGES ============

/**
 * GET /api/chat/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { limit = 50, before, after } = req.query;

    // Verify access
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const query = { 
      conversation: req.params.id,
      isDeleted: false
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    if (after) {
      query.timestamp = { $gt: new Date(after) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'name email avatar')
      .populate('replyTo', 'content sender')
      .lean();

    res.json({
      success: true,
      count: messages.length,
      data: messages.reverse(),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send message (REST fallback - prefer Socket.io)
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { content, type = 'text', metadata } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    // Verify access
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user.id,
      content,
      type,
      metadata
    });

    await message.populate('sender', 'name email avatar');

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

/**
 * PUT /api/chat/messages/:id
 * Edit message
 */
router.put('/messages/:id', async (req, res) => {
  try {
    const { content } = req.body;

    const message = await Message.findOne({
      _id: req.params.id,
      sender: req.user.id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized'
      });
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit message'
    });
  }
});

/**
 * DELETE /api/chat/messages/:id
 * Delete message
 */
router.delete('/messages/:id', async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      sender: req.user.id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized'
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = '[Message deleted]';
    await message.save();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

/**
 * POST /api/chat/messages/:id/reactions
 * Add reaction to message
 */
router.post('/messages/:id/reactions', async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required'
      });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.user.id && r.emoji === emoji
    );

    if (existingReaction) {
      return res.status(400).json({
        success: false,
        message: 'Already reacted with this emoji'
      });
    }

    message.reactions.push({
      user: req.user.id,
      emoji,
      createdAt: new Date()
    });

    await message.save();

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reaction'
    });
  }
});

export default router;
`;

export default chatRoutesTemplate;
