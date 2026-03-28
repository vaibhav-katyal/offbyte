/**
 * Socket/Chat Backend Generator
 * 
 * Generates complete Socket.io backend infrastructure including:
 * - Socket.io server setup
 * - Chat models (Message, Conversation)
 * - REST API routes for chat
 * - Authentication middleware
 */

import { socketServerTemplate } from '../../templates/socket.server.template.js';
import { messageModelTemplate, conversationModelTemplate } from '../../templates/chat.models.template.js';
import { chatRoutesTemplate } from '../../templates/chat.routes.template.js';

/**
 * Generate complete socket/chat backend
 */
export function generateSocketBackend(socketDetection) {
  const files = {};

  // Only generate if socket is detected
  if (!socketDetection || !socketDetection.hasSocket) {
    return files;
  }

  // 1. Socket.io server setup
  files['socket/index.js'] = socketServerTemplate;

  // 2. Chat models
  files['models/Message.js'] = messageModelTemplate;
  files['models/Conversation.js'] = conversationModelTemplate;

  // 3. Chat routes (REST API endpoints)
  files['routes/chat.routes.js'] = chatRoutesTemplate;

  // 4. Package.json dependencies
  const socketDependencies = {
    'socket.io': '^4.6.1',
    'jsonwebtoken': '^9.0.2'
  };

  return {
    files,
    dependencies: socketDependencies,
    instructions: generateSetupInstructions(socketDetection)
  };
}

/**
 * Generate setup instructions
 */
function generateSetupInstructions(socketDetection) {
  const instructions = {
    title: '🔌 Socket.io Chat Backend Generated',
    steps: [
      '1. Install dependencies: npm install socket.io jsonwebtoken',
      '2. Import socket initialization in server.js',
      '3. Initialize Socket.io with HTTP server',
      '4. Register chat routes at /api/chat',
      '5. Set JWT_SECRET in .env file',
      '6. Set CLIENT_URL in .env (for CORS)'
    ],
    features: []
  };

  if (socketDetection.hasChat) {
    instructions.features.push('✅ Real-time messaging');
    instructions.features.push('✅ Message history & persistence');
  }

  if (socketDetection.rooms) {
    instructions.features.push('✅ Rooms/Channels support');
    instructions.features.push('✅ Group conversations');
  }

  if (socketDetection.presence) {
    instructions.features.push('✅ Online/Offline presence');
    instructions.features.push('✅ Typing indicators');
  }

  instructions.features.push('✅ Read receipts');
  instructions.features.push('✅ File sharing support');
  instructions.features.push('✅ Message reactions');
  instructions.features.push('✅ JWT Authentication');

  return instructions;
}

/**
 * Generate modified server.js with Socket.io integration
 */
export function generateServerWithSocket(baseServerCode, hasSocket = false) {
  if (!hasSocket) {
    return baseServerCode;
  }

  let modifiedCode = baseServerCode;

  // Check if already has Socket.io imports
  if (modifiedCode.includes('socket.io') || modifiedCode.includes('initializeSocket')) {
    return modifiedCode; // Already integrated
  }

  // Add Socket.io imports after express import
  const socketImports = `import { createServer } from 'http';
import initializeSocket from './socket/index.js';
`;

  // Insert imports after express import
  modifiedCode = modifiedCode.replace(
    /(import express from ['"]express['"];)/,
    `$1\n${socketImports}`
  );

  // Create HTTP server and initialize Socket.io after app creation
  const serverSetup = `
// ============================================
// SOCKET.IO SETUP
// ============================================
const httpServer = createServer(app);
const io = initializeSocket(httpServer);

// Make io accessible in routes via req.app.get('io')
app.set('io', io);
`;

  // Add server setup after app initialization (after const app = express())
  modifiedCode = modifiedCode.replace(
    /(const app = express\(\);[\s\S]*?const API_VERSION[^;]*;)/,
    `$1\n${serverSetup}`
  );

  // Replace app.listen with httpServer.listen at the end
  modifiedCode = modifiedCode.replace(
    /app\.listen\((PORT[^)]*)\)/g,
    'httpServer.listen($1)'
  );

  return modifiedCode;
}

/**
 * Update package.json with socket dependencies
 */
export function addSocketDependencies(packageJson) {
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }

  packageJson.dependencies['socket.io'] = '^4.6.1';
  packageJson.dependencies['jsonwebtoken'] = '^9.0.2';

  return packageJson;
}

export default {
  generateSocketBackend,
  generateServerWithSocket,
  addSocketDependencies
};
