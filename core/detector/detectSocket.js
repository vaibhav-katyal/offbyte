import babelTraverse from '@babel/traverse';

const traverse = babelTraverse.default || babelTraverse;

/**
 * Socket.io / WebSocket Pattern Detector
 * Detects real-time communication patterns in frontend code
 * 
 * Detects:
 * - Socket.io client initialization
 * - WebSocket connections
 * - Chat UI components
 * - Message sending/receiving
 * - Presence/typing indicators
 * - Room/channel patterns
 */

const CHAT_PATTERNS = {
  socketIo: [
    /io\(['"].*['"]\)/gi,
    /socket\.io-client/gi,
    /new\s+Socket/gi,
    /socketIOClient/gi,
  ],
  websocket: [
    /new\s+WebSocket/gi,
    /ws:\/\//gi,
    /wss:\/\//gi,
  ],
  events: [
    /on\(['"]message/gi,
    /emit\(['"]message/gi,
    /on\(['"]chat/gi,
    /emit\(['"]chat/gi,
    /socket\.send/gi,
    /socket\.on/gi,
    /socket\.emit/gi,
  ],
  chatUI: [
    /sendMessage/gi,
    /receiveMessage/gi,
    /chatBox/gi,
    /messageList/gi,
    /conversation/gi,
    /chat.*input/gi,
    /message.*input/gi,
    /typing.*indicator/gi,
  ],
  presence: [
    /user.*online/gi,
    /user.*offline/gi,
    /presence/gi,
    /is.*typing/gi,
  ],
  rooms: [
    /join.*room/gi,
    /leave.*room/gi,
    /join.*channel/gi,
    /room.*id/gi,
    /channel.*id/gi,
  ]
};

/**
 * Main socket detection function
 */
export function detectSocket(ast, sourceCode) {
  const detections = {
    hasSocket: false,
    hasChat: false,
    socketType: null, // 'socket.io' | 'websocket' | null
    events: [],
    rooms: false,
    presence: false,
    endpoints: []
  };

  // AST-based detection
  traverse(ast, {
    // Detect Socket.io initialization: io('http://...')
    CallExpression(path) {
      const { callee, arguments: args } = path.node;

      // Socket.io: io(url)
      if (callee.type === 'Identifier' && callee.name === 'io') {
        detections.hasSocket = true;
        detections.socketType = 'socket.io';
        
        if (args.length > 0 && args[0].type === 'StringLiteral') {
          detections.endpoints.push({
            type: 'socket.io',
            url: args[0].value
          });
        }
      }

      // Socket.io: socketIOClient(url)
      if (callee.type === 'Identifier' && callee.name === 'socketIOClient') {
        detections.hasSocket = true;
        detections.socketType = 'socket.io';
      }

      // WebSocket: new WebSocket(url)
      if (callee.type === 'NewExpression' && 
          callee.callee?.name === 'WebSocket') {
        detections.hasSocket = true;
        detections.socketType = 'websocket';
        
        if (args.length > 0 && args[0].type === 'StringLiteral') {
          detections.endpoints.push({
            type: 'websocket',
            url: args[0].value
          });
        }
      }

      // Detect socket.emit('event', data)
      if (callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'emit') {
        
        if (args.length > 0 && args[0].type === 'StringLiteral') {
          const eventName = args[0].value;
          detections.events.push({
            type: 'emit',
            name: eventName
          });

          // Check for chat-related events
          if (isChatEvent(eventName)) {
            detections.hasChat = true;
          }

          // Check for room events
          if (isRoomEvent(eventName)) {
            detections.rooms = true;
          }

          // Check for presence events
          if (isPresenceEvent(eventName)) {
            detections.presence = true;
          }
        }
      }

      // Detect socket.on('event', callback)
      if (callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'on') {
        
        if (args.length > 0 && args[0].type === 'StringLiteral') {
          const eventName = args[0].value;
          detections.events.push({
            type: 'on',
            name: eventName
          });

          if (isChatEvent(eventName)) {
            detections.hasChat = true;
          }

          if (isRoomEvent(eventName)) {
            detections.rooms = true;
          }

          if (isPresenceEvent(eventName)) {
            detections.presence = true;
          }
        }
      }
    },

    // Detect import statements
    ImportDeclaration(path) {
      const source = path.node.source.value;
      
      if (source === 'socket.io-client' || source.includes('socket.io')) {
        detections.hasSocket = true;
        detections.socketType = 'socket.io';
      }
    },

    // Detect chat-related variable/function names
    Identifier(path) {
      const name = path.node.name;
      
      if (isChatIdentifier(name)) {
        detections.hasChat = true;
      }
    }
  });

  // Regex-based detection (fallback)
  const regexDetections = detectSocketRegex(sourceCode);
  
  if (regexDetections.hasSocket) {
    detections.hasSocket = true;
    detections.socketType = detections.socketType || regexDetections.socketType;
  }
  
  if (regexDetections.hasChat) {
    detections.hasChat = true;
  }

  if (regexDetections.rooms) {
    detections.rooms = true;
  }

  if (regexDetections.presence) {
    detections.presence = true;
  }

  // Deduplicate events
  detections.events = Array.from(
    new Map(detections.events.map(e => [e.name, e])).values()
  );

  return detections;
}

/**
 * Regex-based socket detection (fallback)
 */
function detectSocketRegex(sourceCode) {
  const result = {
    hasSocket: false,
    hasChat: false,
    socketType: null,
    rooms: false,
    presence: false
  };

  // Check Socket.io patterns
  for (const pattern of CHAT_PATTERNS.socketIo) {
    if (pattern.test(sourceCode)) {
      result.hasSocket = true;
      result.socketType = 'socket.io';
      break;
    }
  }

  // Check WebSocket patterns
  if (!result.hasSocket) {
    for (const pattern of CHAT_PATTERNS.websocket) {
      if (pattern.test(sourceCode)) {
        result.hasSocket = true;
        result.socketType = 'websocket';
        break;
      }
    }
  }

  // Check chat UI patterns
  for (const pattern of CHAT_PATTERNS.chatUI) {
    if (pattern.test(sourceCode)) {
      result.hasChat = true;
      break;
    }
  }

  // Check events
  for (const pattern of CHAT_PATTERNS.events) {
    if (pattern.test(sourceCode)) {
      result.hasChat = true;
      break;
    }
  }

  // Check rooms
  for (const pattern of CHAT_PATTERNS.rooms) {
    if (pattern.test(sourceCode)) {
      result.rooms = true;
      break;
    }
  }

  // Check presence
  for (const pattern of CHAT_PATTERNS.presence) {
    if (pattern.test(sourceCode)) {
      result.presence = true;
      break;
    }
  }

  return result;
}

/**
 * Helper: Check if event name is chat-related
 */
function isChatEvent(eventName) {
  const chatKeywords = [
    'message', 'chat', 'send', 'receive',
    'msg', 'text', 'conversation'
  ];
  
  const lowerName = eventName.toLowerCase();
  return chatKeywords.some(kw => lowerName.includes(kw));
}

/**
 * Helper: Check if event name is room-related
 */
function isRoomEvent(eventName) {
  const roomKeywords = [
    'room', 'channel', 'join', 'leave',
    'subscribe', 'unsubscribe'
  ];
  
  const lowerName = eventName.toLowerCase();
  return roomKeywords.some(kw => lowerName.includes(kw));
}

/**
 * Helper: Check if event name is presence-related
 */
function isPresenceEvent(eventName) {
  const presenceKeywords = [
    'online', 'offline', 'presence',
    'typing', 'active', 'idle'
  ];
  
  const lowerName = eventName.toLowerCase();
  return presenceKeywords.some(kw => lowerName.includes(kw));
}

/**
 * Helper: Check if identifier is chat-related
 */
function isChatIdentifier(name) {
  const chatKeywords = [
    'sendMessage', 'receiveMessage', 'chatBox',
    'messageList', 'messageInput', 'chatInput',
    'conversation', 'chatHistory', 'messageHistory'
  ];
  
  const lowerName = name.toLowerCase();
  return chatKeywords.some(kw => lowerName.includes(kw.toLowerCase()));
}

export default detectSocket;
