/**
 * Chat Models Templates
 * 
 * Provides Mongoose models for:
 * - Message
 * - Conversation
 * - MessageReaction (optional)
 */

export const messageModelTemplate = `import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'system'],
    default: 'text'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // For file messages
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  fileType: String,
  
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  
  // Read receipts
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readAt: Date,
  
  // Edited
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  
  // Deleted
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  
  // Reply/Thread
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Reactions
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ conversation: 1, timestamp: -1 });
messageSchema.index({ sender: 1, timestamp: -1 });
messageSchema.index({ conversation: 1, timestamp: 1 });

// Virtuals
messageSchema.virtual('readCount').get(function() {
  return this.readBy ? this.readBy.length : 0;
});

messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

const Message = mongoose.model('Message', messageSchema);

export default Message;
`;

export const conversationModelTemplate = `import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['direct', 'group', 'channel'],
    default: 'direct',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Last message info
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Group/Channel settings
  description: String,
  avatar: String,
  
  // Muted users
  mutedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    mutedUntil: Date
  }],
  
  // Archived
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Pinned messages
  pinnedMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  
  // Group settings
  settings: {
    allowMemberMessages: {
      type: Boolean,
      default: true
    },
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    maxMembers: {
      type: Number,
      default: 100
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ type: 1, lastMessageAt: -1 });
conversationSchema.index({ createdBy: 1 });

// Methods
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.toString() === userId.toString());
};

conversationSchema.methods.isAdmin = function(userId) {
  return this.admins.some(a => a.toString() === userId.toString());
};

conversationSchema.methods.addParticipant = async function(userId) {
  if (!this.isParticipant(userId)) {
    this.participants.push(userId);
    await this.save();
  }
  return this;
};

conversationSchema.methods.removeParticipant = async function(userId) {
  this.participants = this.participants.filter(
    p => p.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Statics
conversationSchema.statics.findByUser = function(userId) {
  return this.find({ participants: userId, isActive: true })
    .populate('participants', 'name email avatar')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });
};

conversationSchema.statics.findDirectConversation = function(user1Id, user2Id) {
  return this.findOne({
    type: 'direct',
    participants: { $all: [user1Id, user2Id], $size: 2 }
  });
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
`;

export const chatModelsExport = `export { messageModelTemplate, conversationModelTemplate };
`;

export default { messageModelTemplate, conversationModelTemplate };
