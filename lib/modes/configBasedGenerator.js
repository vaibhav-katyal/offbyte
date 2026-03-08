/**
 * Configuration-Based Backend Generator
 * Generates production-level backend for selected tech stack
 */

import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { generateDependencies, getDatabaseConnectionTemplate, getEnvTemplate } from './interactiveSetup.js';

const TEMPLATES_DIR = path.resolve('./templates');

export async function generateWithConfig(projectPath, config) {
  try {
    const backendPath = path.join(projectPath, 'backend');

    // Prevent stale entrypoints when switching frameworks in the same project.
    cleanupFrameworkArtifacts(backendPath, config);

    // Step 1: Create structure
    const step1 = ora('Creating backend structure...').start();
    createBackendStructure(backendPath, config);
    step1.succeed('âœ… Backend structure created');

    // Step 2: Setup database
    const step2 = ora('Setting up database configuration...').start();
    setupDatabaseConfig(backendPath, config);
    step2.succeed('âœ… Database configured');

    // Step 3: Create middleware
    const step3 = ora('Setting up middleware...').start();
    setupMiddleware(backendPath, config);
    step3.succeed('âœ… Middleware configured');

    // Step 4: Create authentication (if enabled)
    if (config.enableAuth) {
      const step4 = ora('Setting up authentication system...').start();
      setupAuthentication(backendPath, config);
      step4.succeed('âœ… Authentication configured');
    }

    // Step 5: Create main server
    const step5 = ora('Creating main server file...').start();
    createServerFile(backendPath, config);
    step5.succeed('âœ… Server created');

    // Step 6: Setup Socket.io (if enabled)
    if (config.enableSocket) {
      const step6 = ora('Setting up realtime sockets...').start();
      setupSockets(backendPath, config);
      step6.succeed('âœ… Sockets configured');
    }

    // Step 7: Create package.json
    const step7 = ora('Creating package.json...').start();
    createPackageJson(backendPath, config);
    step7.succeed('âœ… Dependencies configured');

    // Step 8: Create .env
    const step8 = ora('Creating environment configuration...').start();
    createEnvFile(backendPath, config);
    step8.succeed('âœ… Environment files created (.env, .env.example, .gitignore)');

    // Step 9: Scan frontend and generate detected resources (skip - will be done by smart API)
    const step9 = ora('Skipping sample generation (using Smart API detection instead)...').start();
    step9.succeed('âœ… Backend structure ready for Smart API generation');
    
    // Step 10: Generate SQL files for SQL databases
    if (['mysql', 'postgresql', 'sqlite'].includes(config.database)) {
      const step10 = ora('Generating SQL scripts...').start();
      step10.succeed(`âœ… SQL scripts created in backend/sql/ (ready for ${config.database.toUpperCase()})`);
    }

    console.log(chalk.cyan('\nðŸŽ‰ Backend structure created!\n'));
    console.log(chalk.cyan('âœ… Smart API detection will run automatically next...\n'));
   
    console.log(chalk.yellow('ðŸ“ Next steps:'));
    console.log(chalk.yellow(`   1. cd ${projectPath}/backend`));
    console.log(chalk.yellow('   2. npm install'));
    console.log(chalk.yellow('   3. Review & update .env file:'));
    console.log(chalk.gray('      - Database credentials'));
    console.log(chalk.gray('      - JWT secrets (generate secure keys!)'));
    console.log(chalk.gray('      - CORS origins'));
    console.log(chalk.gray('      - See PRODUCTION CHECKLIST in .env'));
    
    // Add SQL-specific instructions
    if (['mysql', 'postgresql', 'sqlite'].includes(config.database)) {
      console.log(chalk.yellow('   4. Setup database using SQL scripts:'));
      console.log(chalk.gray('      - Check backend/sql/01_schema.sql'));
      console.log(chalk.gray('      - Run in MySQL Workbench or command line'));
      console.log(chalk.gray('      - See backend/sql/README.md for instructions'));
      console.log(chalk.yellow('   5. npm run dev'));
    } else {
      console.log(chalk.yellow('   4. npm run dev'));
    }
    
    console.log(chalk.cyan('\nðŸ’¡ Tip: Never commit .env to git! Use .env.example instead.\n'));

  } catch (error) {
    console.error(chalk.red('âŒ Error generating backend:'), error.message);
    throw error;
  }
}

function cleanupFrameworkArtifacts(backendPath, config) {
  if (!fs.existsSync(backendPath)) {
    return;
  }

  const removeIfExists = (relativePath) => {
    const fullPath = path.join(backendPath, relativePath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  };

  if (config.framework === 'nestjs') {
    // NestJS starts from main.ts and app.module.ts; old JS entrypoint causes confusion.
    removeIfExists('server.js');
  } else {
    // Express/Fastify start from server.js; old Nest entrypoints are stale.
    removeIfExists('main.ts');
    removeIfExists('app.module.ts');
    removeIfExists('tsconfig.json');
  }
}

function createBackendStructure(backendPath, config) {
  const dirs = [
    'config',
    'middleware',
    'models',
    'controllers',
    'routes',
    'services',
    'utils',
    'validators',
  ];

  if (config.enableSocket) {
    dirs.push('socket', 'events');
  }

  if (config.enableAuth) {
    dirs.push('auth');
  }

  for (const dir of dirs) {
    const dirPath = path.join(backendPath, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Create directories if they don't exist
  if (!fs.existsSync(backendPath)) {
    fs.mkdirSync(backendPath, { recursive: true });
  }
}

function setupDatabaseConfig(backendPath, config) {
  const dbConfig = getDatabaseConnectionTemplate(config);
  
  const configPath = path.join(backendPath, 'config');
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(configPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(configPath, 'database.js'),
    dbConfig
  );
}

function setupMiddleware(backendPath, config) {
  const middlewarePath = path.join(backendPath, 'middleware');

  // Error handler
  const errorHandler = `export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};`;

  fs.writeFileSync(path.join(middlewarePath, 'errorHandler.js'), errorHandler);

  // Request logger
  const logger = `import morgan from 'morgan';

export const requestLogger = morgan(':method :url :status :response-time ms');`;

  fs.writeFileSync(path.join(middlewarePath, 'logger.js'), logger);

  // Validation middleware required by generated CRUD routes
  const validation = `import { validationResult } from 'express-validator';

export const validateErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

export const validateRequest = (schema) => {
  return (req, res, next) => {
    // If no schema is provided, just continue.
    if (!schema || typeof schema.validate !== 'function') {
      return next();
    }

    const { error, value } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    req.validatedBody = value;
    next();
  };
};`;

  fs.writeFileSync(path.join(middlewarePath, 'validation.js'), validation);

  // Rate limiter
  const rateLimiter = `export const rateLimiter = (limit = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip).filter(time => now - time < windowMs);
    
    if (userRequests.length >= limit) {
      return res.status(429).json({ message: 'Too many requests' });
    }
    
    userRequests.push(now);
    requests.set(ip, userRequests);
    next();
  };
};`;

  fs.writeFileSync(path.join(middlewarePath, 'rateLimiter.js'), rateLimiter);
}

function setupAuthentication(backendPath, config) {
  const authPath = path.join(backendPath, 'auth');

  if (config.authType === 'jwt') {
    // JWT Auth
    const jwtAuth = `import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};`;

    fs.writeFileSync(path.join(authPath, 'jwtAuth.js'), jwtAuth);
  }
}

function createServerFile(backendPath, config) {
  // Framework-specific server generation
  if (config.framework === 'express') {
    createExpressServer(backendPath, config);
  } else if (config.framework === 'fastify') {
    createFastifyServer(backendPath, config);
  } else if (config.framework === 'nestjs') {
    createNestJSServer(backendPath, config);
  } else {
    // Default to Express
    createExpressServer(backendPath, config);
  }
}

// Express Server Implementation
function createExpressServer(backendPath, config) {
  let serverContent = `import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
`;

  if (config.enableValidation) {
    serverContent += `import { validateRequest } from './middleware/validation.js';\n`;
  }

  if (config.enableSocket) {
    serverContent += `import { createServer } from 'http';
import { Server } from 'socket.io';
import { handleSocketEvents } from './socket/handlers.js';
`;
  }

  serverContent += `
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
`;

  if (config.enableSocket) {
    serverContent += `const server = createServer(app);
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

server.listen(PORT, () => {
  console.log(\`ðŸš€ Server running on http://localhost:\${PORT}\`);
});`;
  } else {
    serverContent += `app.listen(PORT, () => {
  console.log(\`ðŸš€ Server running on http://localhost:\${PORT}\`);
});`;
  }

  fs.writeFileSync(path.join(backendPath, 'server.js'), serverContent);
}

// Fastify Server Implementation
function createFastifyServer(backendPath, config) {
  let serverContent = `import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';

dotenv.config();

const fastify = Fastify({
  logger: ${config.enableLogging ? 'true' : 'false'}
});

const PORT = process.env.PORT || 5000;

// Register plugins
await fastify.register(fastifyHelmet);
await fastify.register(fastifyCors, { origin: '*' });

// Database Connection
connectDatabase().then(() => {
  fastify.log.info('âœ… Database connected');
}).catch(error => {
  fastify.log.error('âŒ Database connection failed:', error);
  process.exit(1);
});

// Health Check
fastify.get('/api/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

`;

  if (config.enableSocket) {
    serverContent += `// Socket.io with Fastify
import { Server } from 'socket.io';
import { handleSocketEvents } from './socket/handlers.js';

const server = fastify.server;
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  fastify.log.info('User connected: ' + socket.id);
  handleSocketEvents(io, socket);
  
  socket.on('disconnect', () => {
    fastify.log.info('User disconnected: ' + socket.id);
  });
});

`;
  }

  serverContent += `// Start server
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(\`ðŸš€ Fastify server running on http://localhost:\${PORT}\`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}`;

  fs.writeFileSync(path.join(backendPath, 'server.js'), serverContent);
}

// NestJS Server Implementation  
function createNestJSServer(backendPath, config) {
  // Main.ts - Entry point
  const mainContent = `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
${config.enableSocket ? `import { Server } from 'socket.io';` : ''}

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global prefix
  app.setGlobalPrefix('api');
  
  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  });
  
  ${config.enableValidation ? `// Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));` : ''}
  
  const PORT = process.env.PORT || 5000;
  await app.listen(PORT);
  ${config.enableSocket ? `
  const io = new Server(app.getHttpServer(), {
    cors: { origin: process.env.CORS_ORIGIN || '*' }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('message:send', (data) => {
      io.emit('message:new', data);
    });

    socket.on('user:typing', (data) => {
      socket.broadcast.emit('user:typing', data);
    });

    socket.on('user:stopped-typing', (data) => {
      socket.broadcast.emit('user:stopped-typing', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
` : ''}
  console.log(\`ðŸš€ NestJS server running on http://localhost:\${PORT}\`);
}

bootstrap();`;

  fs.writeFileSync(path.join(backendPath, 'main.ts'), mainContent);

  // App Module
  const appModuleContent = `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
${config.database === 'mongodb' ? `import { MongooseModule } from '@nestjs/mongoose';` : ''}
${['postgresql', 'mysql', 'sqlite'].includes(config.database) ? `import { TypeOrmModule } from '@nestjs/typeorm';` : ''}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
${config.database === 'mongodb' ? `    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/offbyte'),` : ''}
${config.database === 'postgresql' ? `    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'offbyte',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV === 'development'
    }),` : ''}
${config.database === 'mysql' ? `    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'offbyte',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV === 'development'
    }),` : ''}
${config.database === 'sqlite' ? `    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.SQLITE_PATH || './database.sqlite',
      autoLoadEntities: true,
      synchronize: true
    }),` : ''}
  ],
  controllers: [],
  providers: []
})
export class AppModule {}`;

  fs.writeFileSync(path.join(backendPath, 'app.module.ts'), appModuleContent);

  // Create tsconfig.json
  const tsconfigContent = `{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true
  },
  "include": ["*.ts", "**/*.ts"],
  "exclude": ["node_modules", "dist"]
}`;

  fs.writeFileSync(path.join(backendPath, 'tsconfig.json'), tsconfigContent);
}

function setupSockets(backendPath, config) {
  const socketPath = path.join(backendPath, 'socket');
  const eventsPath = path.join(backendPath, 'events');

  // Create socket event handlers
  const socketHandler = `export const handleSocketEvents = (io, socket) => {
  socket.on('message:send', (data) => {
    io.emit('message:new', data);
  });

  socket.on('user:typing', (data) => {
    socket.broadcast.emit('user:typing', data);
  });

  socket.on('user:stopped-typing', (data) => {
    socket.broadcast.emit('user:stopped-typing', data);
  });
};`;

  fs.writeFileSync(path.join(socketPath, 'handlers.js'), socketHandler);

  // Create event emitters
  const eventEmitter = `import { EventEmitter } from 'events';

export const appEvents = new EventEmitter();

appEvents.setMaxListeners(20);`;

  fs.writeFileSync(path.join(eventsPath, 'emitter.js'), eventEmitter);
}

function createPackageJson(backendPath, config) {
  const dependencies = generateDependencies(config);

  const scripts = config.framework === 'nestjs'
    ? {
        build: 'tsc',
        start: 'node dist/main.js',
        dev: 'ts-node-dev --respawn --transpile-only main.ts',
        'start:prod': 'node dist/main.js',
        test: 'echo "Error: no test specified" && exit 1'
      }
    : {
        dev: 'node server.js',
        start: 'node server.js',
        test: 'echo "Error: no test specified" && exit 1'
      };

  const devDependencies = {
    nodemon: '^3.0.1'
  };

  if (config.framework === 'nestjs') {
    devDependencies['@nestjs/cli'] = '^10.2.1';
    devDependencies['@nestjs/schematics'] = '^10.0.3';
    devDependencies['@types/node'] = '^20.8.9';
    devDependencies['typescript'] = '^5.2.2';
    devDependencies['ts-node'] = '^10.9.1';
    devDependencies['ts-node-dev'] = '^2.0.0';

    if (config.database === 'mongodb') {
      dependencies['@nestjs/mongoose'] = '^10.0.2';
    } else {
      dependencies['@nestjs/typeorm'] = '^10.0.1';
      dependencies['typeorm'] = '^0.3.17';
    }

    if (config.enableValidation) {
      dependencies['class-transformer'] = '^0.5.1';
    }
  } else {
    // Generated route templates import from express-validator.
    if (!dependencies['express-validator']) {
      dependencies['express-validator'] = '^7.0.0';
    }
  }
  
  const packageJson = {
    name: 'offbyte-backend',
    version: '1.0.0',
    description: 'Production-ready backend generated by offbyte',
    type: config.framework === 'nestjs' ? 'commonjs' : 'module',
    main: config.framework === 'nestjs' ? 'dist/main.js' : 'server.js',
    scripts,
    dependencies,
    devDependencies
  };

  fs.writeFileSync(
    path.join(backendPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

function createEnvFile(backendPath, config) {
  const envTemplate = getEnvTemplate(config);
  
  // Create .env file
  fs.writeFileSync(path.join(backendPath, '.env'), envTemplate);
  
  // Create .env.example for version control
  fs.writeFileSync(path.join(backendPath, '.env.example'), envTemplate);
  
  // Create/Update .gitignore to exclude .env
  const gitignorePath = path.join(backendPath, '.gitignore');
  let gitignoreContent = '';
  
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  }
  
  if (!gitignoreContent.includes('.env')) {
    gitignoreContent += `\n# Environment variables\n.env\n.env.local\n.env.*.local\n\n# Logs\nlogs\n*.log\n\n# Dependency directories\nnode_modules/\n\n# Production build\nbuild/\ndist/\n\n# OS files\n.DS_Store\nThumbs.db\n`;
    fs.writeFileSync(gitignorePath, gitignoreContent);
  }
}

async function detectAndGenerateResources(projectPath, backendPath, config) {
  try {
    // Extract API info from frontend code
    const resources = new Map();
    const apiEndpoints = new Set();
    
    // Try to scan pages directory
    const pagesDir = path.join(projectPath, 'src', 'pages');
    if (fs.existsSync(pagesDir)) {
      const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));
      
      files.forEach(file => {
        const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
        const fileEndpoints = extractApiEndpointsFromCode(content);
        fileEndpoints.forEach(endpoint => apiEndpoints.add(endpoint));
        
        // Detect resources from all API endpoint shapes, including nested routes
        fileEndpoints.forEach(endpoint => {
          const segments = endpoint
            .replace(/^\/api\//, '')
            .split('/')
            .filter(Boolean);

          if (segments.length === 0) {
            return;
          }

          const topResource = segments[0];
          ensureResourceEntry(resources, topResource, content);

          // Nested pattern: /api/{parent}/:id/{child}
          for (let i = 0; i < segments.length - 2; i++) {
            const parent = segments[i];
            const param = segments[i + 1];
            const child = segments[i + 2];

            if (!parent.startsWith(':') && param.startsWith(':') && !child.startsWith(':')) {
              ensureResourceEntry(resources, child, content);
            }
          }
        });

        // Keep operation hints updated for each detected resource in this file
        resources.forEach((resourceInfo, resourceName) => {
          resourceInfo.hasCreate = resourceInfo.hasCreate || hasOperationForResource(content, resourceName, 'post');
          resourceInfo.hasUpdate = resourceInfo.hasUpdate || hasOperationForResource(content, resourceName, 'put') || hasOperationForResource(content, resourceName, 'patch');
          resourceInfo.hasDelete = resourceInfo.hasDelete || hasOperationForResource(content, resourceName, 'delete');
          resourceInfo.hasList = resourceInfo.hasList || hasOperationForResource(content, resourceName, 'get');
        });
      });
    }

    const apiAnalysis = analyzeApiStructure(apiEndpoints, resources);

    // Hydrate child foreign-key columns from nested endpoint relationships
    apiAnalysis.relationships.forEach(rel => {
      const childResource = resources.get(rel.child);
      if (!childResource) {
        return;
      }

      const fkField = buildForeignKeyName(rel.parent);
      if (!childResource.fields.includes(fkField)) {
        childResource.fields.push(fkField);
      }
    });

    // Attach relation metadata to resources for framework-specific generators
    resources.forEach((resourceInfo, resourceName) => {
      resourceInfo.parentRelations = apiAnalysis.relationships.filter(rel => rel.child === resourceName);
      resourceInfo.childRelations = apiAnalysis.relationships.filter(rel => rel.parent === resourceName);
    });

    // Generate models and routes for detected resources
    const generatedResources = [];
    resources.forEach((resourceInfo, resourceName) => {
      try {
        generateModel(backendPath, resourceName, resourceInfo, config);
        generateRoute(backendPath, resourceName, resourceInfo, config, apiAnalysis);
        generatedResources.push(resourceName);
      } catch (e) {
        console.warn(`âš ï¸  Skipped ${resourceName}:`, e.message);
      }
    });

    // If no resources detected, generate samples
    if (generatedResources.length === 0) {
      createSampleResources(backendPath, config);
      
      // Generate SQL files even for sample resources
      if (['mysql', 'postgresql', 'sqlite'].includes(config.database)) {
        const sampleResources = new Map();
        sampleResources.set('users', {
          name: 'users',
          fields: ['name', 'email', 'password'],
          hasAuth: false
        });
        generateSQLFiles(backendPath, sampleResources, config, { relationships: [] });
      }
      
      return { resources: ['User (sample)'] };
    }

    // Generate SQL files for SQL databases
    if (['mysql', 'postgresql', 'sqlite'].includes(config.database)) {
      generateSQLFiles(backendPath, resources, config, apiAnalysis);
    }

    // Update server.js with routes
    updateServerWithRoutes(backendPath, generatedResources, config);

    return { resources: generatedResources };
  } catch (error) {
    console.warn('âš ï¸  Auto-detection error:', error.message);
    createSampleResources(backendPath, config);
    return { resources: ['User (sample)'] };
  }
}

function ensureResourceEntry(resources, resourceName, content) {
  if (!resourceName || resourceName.startsWith(':')) {
    return;
  }

  if (!resources.has(resourceName)) {
    resources.set(resourceName, {
      name: resourceName,
      fields: extractFieldsFromCode(content, resourceName),
      hasCreate: false,
      hasUpdate: false,
      hasDelete: false,
      hasList: false
    });
  }
}

function hasOperationForResource(content, resourceName, method) {
  const escaped = resourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const axiosRegex = new RegExp(`axios\\.${method}\\s*\\(\\s*['\"\"]/api/${escaped}(?:/|[\"'\\?])`, 'i');
  const fetchRegex = new RegExp(`fetch\\s*\\(\\s*['\"\"]/api/${escaped}(?:/|[\"'\\?]).*?(method\\s*:\\s*['\"]${method.toUpperCase()}['\"])?`, 'is');

  if (method === 'get') {
    return axiosRegex.test(content) || new RegExp(`fetch\\s*\\(\\s*['\"\"]/api/${escaped}(?:/|[\"'\\?])`, 'i').test(content);
  }

  return axiosRegex.test(content) || fetchRegex.test(content);
}

function extractApiEndpointsFromCode(content) {
  const endpoints = new Set();
  const callRegexes = [
    /axios\.(?:get|post|put|delete|patch)\s*\(\s*['\"`]([^'\"`]+)['\"`]/gi,
    /fetch\s*\(\s*['\"`]([^'\"`]+)['\"`]/gi
  ];

  callRegexes.forEach(regex => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const value = match[1];
      const apiIndex = value.indexOf(`/api/`);
      if (apiIndex === -1) {
        continue;
      }

      const endpoint = normalizeApiEndpoint(value.slice(apiIndex));
      if (endpoint.startsWith(`/api/`)) {
        endpoints.add(endpoint);
      }
    }
  });

  // Fallback: find plain /api/... paths in strings if call parser misses any
  const fallbackRegex = /\/api\/[A-Za-z0-9_\-/:${}.]+/g;
  const fallbackMatches = content.match(fallbackRegex) || [];
  fallbackMatches.forEach(item => endpoints.add(normalizeApiEndpoint(item)));

  return Array.from(endpoints);
}

function normalizeApiEndpoint(endpoint) {
  let normalized = endpoint.trim();
  normalized = normalized.replace(/\$\{[^}]+\}/g, ':id');
  normalized = normalized.split('?')[0];
  normalized = normalized.replace(/\/+$/g, '');
  if (!normalized.startsWith(`/api/`)) {
    return normalized;
  }
  return normalized;
}

function analyzeApiStructure(apiEndpoints, resources) {
  const relationships = [];
  const seenPairs = new Set();

  apiEndpoints.forEach(endpoint => {
    const segments = endpoint
      .replace(/^\/api\//, '')
      .split('/')
      .filter(Boolean);

    for (let i = 0; i < segments.length - 2; i++) {
      const parent = segments[i];
      const param = segments[i + 1];
      const child = segments[i + 2];

      if (parent.startsWith(':') || child.startsWith(':') || !param.startsWith(':')) {
        continue;
      }

      if (!resources.has(parent) || !resources.has(child) || parent === child) {
        continue;
      }

      const key = `${parent}->${child}`;
      if (seenPairs.has(key)) {
        continue;
      }

      seenPairs.add(key);
      relationships.push({ parent, child, viaParam: param });
    }
  });

  return {
    endpoints: Array.from(apiEndpoints),
    relationships
  };
}

function buildForeignKeyName(parentResource) {
  const singular = parentResource.endsWith('s') && parentResource.length > 1
    ? parentResource.slice(0, -1)
    : parentResource;
  return `${singular}Id`;
}

function extractFieldsFromCode(content, resourceName) {
  const fields = new Set();
  
  // Look for useState patterns like setNewProduct({ name: '', price: '', ...})
  const statePatterns = content.match(/setNew\w+\([{][^}]*[}]/g) || [];
  statePatterns.forEach(pattern => {
    const fieldMatches = pattern.match(/(\w+):/g);
    if (fieldMatches) {
      fieldMatches.forEach(field => {
        const fieldName = field.replace(':', '');
        if (fieldName && !['id', 'createdAt', 'updatedAt'].includes(fieldName)) {
          fields.add(fieldName);
        }
      });
    }
  });

  return Array.from(fields).slice(0, 8); // Limit to 8 fields
}

function generateModel(backendPath, resourceName, resourceInfo, config) {
  if (config.framework === 'nestjs') {
    generateNestJSModel(backendPath, resourceName, resourceInfo, config);
  } else {
    // Express and Fastify use the same model structure
    generateExpressFastifyModel(backendPath, resourceName, resourceInfo, config);
  }
}

function generateExpressFastifyModel(backendPath, resourceName, resourceInfo, config) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).toLowerCase();
  const fields = resourceInfo.fields || ['name', 'description'];
  
  let modelCode = '';
  
  if (config.database === 'mongodb') {
    const schemaFields = fields
      .map(f => `  ${f}: { type: String, trim: true }`)
      .join(',\n');
    const schemaFieldBlock = schemaFields ? `${schemaFields},\n` : '';
    
    modelCode = `import mongoose from 'mongoose';

const ${modelName.toLowerCase()}Schema = new mongoose.Schema({
${schemaFieldBlock}  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const ${modelName} = mongoose.model('${modelName}', ${modelName.toLowerCase()}Schema);`;
  } else {
    const sequelizeFields = fields
      .map(f => `  ${f}: { type: DataTypes.STRING, allowNull: true },`)
      .join('\n');
    
    modelCode = `import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const ${modelName} = sequelize.define('${modelName}', {
${sequelizeFields}
}, {
  timestamps: true
});`;
  }

  const modelPath = path.join(backendPath, 'models', `${modelName}.js`);
  fs.writeFileSync(modelPath, modelCode);
}

function generateNestJSModel(backendPath, resourceName, resourceInfo, config) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).toLowerCase();
  const fields = resourceInfo.fields || ['name', 'description'];
  
  let modelCode = '';
  
  if (config.database === 'mongodb') {
    const schemaFields = fields
      .map(f => `  @Prop({ required: false })\n  ${f}: string;`)
      .join('\n\n');
    
    modelCode = `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ${modelName} extends Document {
${schemaFields}

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ${modelName}Schema = SchemaFactory.createForClass(${modelName});`;
  } else {
    // TypeORM for SQL databases
    const entityFields = fields
      .map(f => getNestEntityFieldDefinition(f))
      .join('\n\n');
    
    modelCode = `import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('${resourceName}')
export class ${modelName} {
  @PrimaryGeneratedColumn()
  id: number;

${entityFields}

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}`;
  }

  // NestJS uses entities folder for SQL, schemas for MongoDB
  const folder = config.database === 'mongodb' ? 'schemas' : 'entities';
  const folderPath = path.join(backendPath, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  const modelPath = path.join(folderPath, `${modelName.toLowerCase()}.entity.ts`);
  fs.writeFileSync(modelPath, modelCode);

  // Compatibility model file for users expecting /models in NestJS mode
  const modelsPath = path.join(backendPath, 'models');
  if (!fs.existsSync(modelsPath)) {
    fs.mkdirSync(modelsPath, { recursive: true });
  }
  const modelCompatCode = config.database === 'mongodb'
    ? `export { ${modelName} } from '../schemas/${modelName.toLowerCase()}.entity';\n`
    : `export { ${modelName} } from '../entities/${modelName.toLowerCase()}.entity';\n`;
  fs.writeFileSync(path.join(modelsPath, `${resourceName}.model.ts`), modelCompatCode);
}

function getNestEntityFieldDefinition(fieldName) {
  if (fieldName.endsWith('Id')) {
    return `  @Column({ nullable: true, type: 'int' })\n  ${fieldName}: number;`;
  }
  if (fieldName.includes('price') || fieldName.includes('amount')) {
    return `  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })\n  ${fieldName}: number;`;
  }
  if (fieldName.includes('stock') || fieldName.includes('count') || fieldName.includes('quantity')) {
    return `  @Column({ nullable: true, type: 'int' })\n  ${fieldName}: number;`;
  }
  if (fieldName.includes('is') || fieldName.includes('has')) {
    return `  @Column({ nullable: true, default: false })\n  ${fieldName}: boolean;`;
  }
  if (fieldName.includes('description') || fieldName.includes('content') || fieldName.includes('text')) {
    return `  @Column({ nullable: true, type: 'text' })\n  ${fieldName}: string;`;
  }
  return `  @Column({ nullable: true })\n  ${fieldName}: string;`;
}

function generateRoute(backendPath, resourceName, resourceInfo, config, apiAnalysis) {
  if (config.framework === 'express') {
    generateExpressRoute(backendPath, resourceName, resourceInfo, config);
  } else if (config.framework === 'fastify') {
    generateFastifyRoute(backendPath, resourceName, resourceInfo, config);
  } else if (config.framework === 'nestjs') {
    generateNestJSController(backendPath, resourceName, resourceInfo, config, apiAnalysis);
  }
}

function generateExpressRoute(backendPath, resourceName, resourceInfo, config) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).toLowerCase();
  const listQuery = config.database === 'mongodb'
    ? `${modelName}.find().sort({ createdAt: -1 })`
    : `${modelName}.findAll()`;
  
  const routeCode = `import express from 'express';
import { ${modelName} } from '../models/${modelName}.js';

const router = express.Router();

// GET all ${resourceName}
router.get('/', async (req, res) => {
  try {
    const items = await ${listQuery};
    res.json({ data: items, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// GET ${resourceName} by ID
router.get('/:id', async (req, res) => {
  try {
    const item = await ${modelName}.${config.database === 'mongodb' ? 'findById' : 'findByPk'}(req.params.id);
    if (!item) {
      return res.status(404).json({ error: '${modelName} not found', success: false });
    }
    res.json({ data: item, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// POST create ${resourceName}
router.post('/', async (req, res) => {
  try {
    const item = ${config.database === 'mongodb' ? `new ${modelName}(req.body);
    await item.save();` : `await ${modelName}.create(req.body);`}
    res.status(201).json({ data: item, success: true });
  } catch (error) {
    res.status(400).json({ error: error.message, success: false });
  }
});

// PUT update ${resourceName}
router.put('/:id', async (req, res) => {
  try {
    const item = await ${modelName}.${config.database === 'mongodb' ? 'findByIdAndUpdate(req.params.id, req.body, { new: true })' : 'update(req.body, { where: { id: req.params.id }, returning: true })'};
    if (!item) {
      return res.status(404).json({ error: '${modelName} not found', success: false });
    }
    res.json({ data: item, success: true });
  } catch (error) {
    res.status(400).json({ error: error.message, success: false });
  }
});

// DELETE ${resourceName}
router.delete('/:id', async (req, res) => {
  try {
    const item = await ${modelName}.${config.database === 'mongodb' ? 'findByIdAndDelete' : 'destroy({ where: { id: req.params.id } })'}(req.params.id);
    if (!item) {
      return res.status(404).json({ error: '${modelName} not found', success: false });
    }
    res.json({ message: '${modelName} deleted', success: true });
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

export default router;`;

  const routePath = path.join(backendPath, 'routes', `${resourceName}.routes.js`);
  fs.writeFileSync(routePath, routeCode);
}

function generateFastifyRoute(backendPath, resourceName, resourceInfo, config) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).toLowerCase();
  const listQuery = config.database === 'mongodb'
    ? `${modelName}.find().sort({ createdAt: -1 })`
    : `${modelName}.findAll()`;
  
  const routeCode = `import { ${modelName} } from '../models/${modelName}.js';

export default async function ${resourceName}Routes(fastify, opts) {
  // GET all ${resourceName}
  fastify.get('/api/${resourceName}', async (request, reply) => {
    try {
      const items = await ${listQuery};
      return { data: items, success: true };
    } catch (error) {
      reply.code(500);
      return { error: error.message, success: false };
    }
  });

  // GET ${resourceName} by ID
  fastify.get('/api/${resourceName}/:id', async (request, reply) => {
    try {
      const item = await ${modelName}.${config.database === 'mongodb' ? 'findById' : 'findByPk'}(request.params.id);
      if (!item) {
        reply.code(404);
        return { error: '${modelName} not found', success: false };
      }
      return { data: item, success: true };
    } catch (error) {
      reply.code(500);
      return { error: error.message, success: false };
    }
  });

  // POST create ${resourceName}
  fastify.post('/api/${resourceName}', async (request, reply) => {
    try {
      const item = ${config.database === 'mongodb' ? `new ${modelName}(request.body);
      await item.save();` : `await ${modelName}.create(request.body);`}
      reply.code(201);
      return { data: item, success: true };
    } catch (error) {
      reply.code(400);
      return { error: error.message, success: false };
    }
  });

  // PUT update ${resourceName}
  fastify.put('/api/${resourceName}/:id', async (request, reply) => {
    try {
      const item = await ${modelName}.${config.database === 'mongodb' ? 'findByIdAndUpdate(request.params.id, request.body, { new: true })' : 'update(request.body, { where: { id: request.params.id }, returning: true })'};
      if (!item) {
        reply.code(404);
        return { error: '${modelName} not found', success: false };
      }
      return { data: item, success: true };
    } catch (error) {
      reply.code(400);
      return { error: error.message, success: false };
    }
  });

  // DELETE ${resourceName}
  fastify.delete('/api/${resourceName}/:id', async (request, reply) => {
    try {
      const item = await ${modelName}.${config.database === 'mongodb' ? 'findByIdAndDelete' : 'destroy({ where: { id: request.params.id } })'}(request.params.id);
      if (!item) {
        reply.code(404);
        return { error: '${modelName} not found', success: false };
      }
      return { message: '${modelName} deleted', success: true };
    } catch (error) {
      reply.code(500);
      return { error: error.message, success: false };
    }
  });
}`;

  const routePath = path.join(backendPath, 'routes', `${resourceName}.routes.js`);
  fs.writeFileSync(routePath, routeCode);
}

function generateNestJSController(backendPath, resourceName, resourceInfo, config, apiAnalysis) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).toLowerCase();
  const serviceName = `${modelName}Service`;
  const controllerName = `${modelName}Controller`;
  const isMongo = config.database === 'mongodb';
  const idType = isMongo ? 'string' : 'number';
  const incomingRelations = getIncomingRelationships(apiAnalysis, resourceName);
  const primaryRelation = incomingRelations.length > 0 ? incomingRelations[0] : null;
  const relationFieldName = primaryRelation ? buildForeignKeyName(primaryRelation.parent) : null;
  const relationParamName = relationFieldName || 'parentId';
  const controllerBasePath = primaryRelation
    ? `${primaryRelation.parent}/:${relationParamName}/${resourceName}`
    : resourceName;

  const parseNumeric = (valueName) => (isMongo ? valueName : `Number(${valueName})`);

  const relationServiceMethods = primaryRelation ? `
  async findByRelation(${relationParamName}: ${idType}) {
    ${isMongo
      ? `return this.${modelName.toLowerCase()}Model.find({ ${relationFieldName}: ${relationParamName} }).exec();`
      : `return this.${modelName.toLowerCase()}Repository.find({ where: { ${relationFieldName}: ${relationParamName} } as any });`}
  }

  async createForRelation(${relationParamName}: ${idType}, data: Partial<${modelName}>) {
    ${isMongo
      ? `const item = new this.${modelName.toLowerCase()}Model({ ...data, ${relationFieldName}: ${relationParamName} });
    return item.save();`
      : `return this.${modelName.toLowerCase()}Repository.save({ ...data, ${relationFieldName}: ${relationParamName} } as any);`}
  }
` : '';

  // Generate Service
  const serviceCode = `import { Injectable } from '@nestjs/common';
${isMongo ? `import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ${modelName} } from '../schemas/${modelName.toLowerCase()}.entity';` : `import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${modelName} } from '../entities/${modelName.toLowerCase()}.entity';`}

@Injectable()
export class ${serviceName} {
  constructor(
    ${isMongo ? `@InjectModel(${modelName}.name) private ${modelName.toLowerCase()}Model: Model<${modelName}>` : `@InjectRepository(${modelName}) private ${modelName.toLowerCase()}Repository: Repository<${modelName}>`}
  ) {}

  async findAll() {
    ${isMongo ? `return this.${modelName.toLowerCase()}Model.find().exec();` : `return this.${modelName.toLowerCase()}Repository.find();`}
  }

  async findOne(id: ${idType}) {
    ${isMongo ? `return this.${modelName.toLowerCase()}Model.findById(id).exec();` : `return this.${modelName.toLowerCase()}Repository.findOne({ where: { id } });`}
  }

  async create(data: Partial<${modelName}>) {
    ${isMongo ? `const item = new this.${modelName.toLowerCase()}Model(data);
    return item.save();` : `return this.${modelName.toLowerCase()}Repository.save(data as any);`}
  }

  async update(id: ${idType}, data: Partial<${modelName}>) {
    ${isMongo ? `return this.${modelName.toLowerCase()}Model.findByIdAndUpdate(id, data, { new: true }).exec();` : `await this.${modelName.toLowerCase()}Repository.update(id, data as any);
    return this.findOne(id);`}
  }

  async remove(id: ${idType}) {
    ${isMongo ? `return this.${modelName.toLowerCase()}Model.findByIdAndDelete(id).exec();` : `return this.${modelName.toLowerCase()}Repository.delete(id);`}
  }
${relationServiceMethods}}
`;

  const relationControllerMethods = primaryRelation ? `
  @Get()
  async findAllByRelation(@Param('${relationParamName}') ${relationParamName}: ${idType}) {
    const items = await this.${modelName.toLowerCase()}Service.findByRelation(${parseNumeric(relationParamName)} as ${idType});
    return { data: items, success: true };
  }

  @Post()
  async createForRelation(@Param('${relationParamName}') ${relationParamName}: ${idType}, @Body() data: any) {
    const item = await this.${modelName.toLowerCase()}Service.createForRelation(${parseNumeric(relationParamName)} as ${idType}, data);
    return { data: item, success: true };
  }
` : `
  @Get()
  async findAll() {
    const items = await this.${modelName.toLowerCase()}Service.findAll();
    return { data: items, success: true };
  }

  @Post()
  async create(@Body() data: any) {
    const item = await this.${modelName.toLowerCase()}Service.create(data);
    return { data: item, success: true };
  }
`;

  // Generate Controller
  const controllerCode = `import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ${serviceName} } from '../services/${modelName.toLowerCase()}.service';

@Controller('${controllerBasePath}')
export class ${controllerName} {
  constructor(private readonly ${modelName.toLowerCase()}Service: ${serviceName}) {}
${relationControllerMethods}
  @Get(':id')
  async findOne(@Param('id') id: ${idType}) {
    const item = await this.${modelName.toLowerCase()}Service.findOne(${parseNumeric('id')} as ${idType});
    if (!item) {
      return { error: '${modelName} not found', success: false };
    }
    return { data: item, success:  true };
  }

  @Put(':id')
  async update(@Param('id') id: ${idType}, @Body() data: any) {
    const item = await this.${modelName.toLowerCase()}Service.update(${parseNumeric('id')} as ${idType}, data);
    return { data: item, success: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: ${idType}) {
    await this.${modelName.toLowerCase()}Service.remove(${parseNumeric('id')} as ${idType});
    return { message: '${modelName} deleted', success: true };
  }
}
`;

  // Generate Module
  const moduleCode = `import { Module } from '@nestjs/common';
${isMongo ? `import { MongooseModule } from '@nestjs/mongoose';
import { ${modelName}, ${modelName}Schema } from '../schemas/${modelName.toLowerCase()}.entity';` : `import { TypeOrmModule } from '@nestjs/typeorm';
import { ${modelName} } from '../entities/${modelName.toLowerCase()}.entity';`}
import { ${serviceName} } from '../services/${modelName.toLowerCase()}.service';
import { ${controllerName} } from '../controllers/${modelName.toLowerCase()}.controller';

@Module({
  imports: [${isMongo ? `MongooseModule.forFeature([{ name: ${modelName}.name, schema: ${modelName}Schema }])` : `TypeOrmModule.forFeature([${modelName}])`}],
  controllers: [${controllerName}],
  providers: [${serviceName}],
  exports: [${serviceName}]
})
export class ${modelName}Module {}
`;

  // Create folders
  const controllersPath = path.join(backendPath, 'controllers');
  if (!fs.existsSync(controllersPath)) {
    fs.mkdirSync(controllersPath, { recursive: true });
  }

  const servicesPath = path.join(backendPath, 'services');
  if (!fs.existsSync(servicesPath)) {
    fs.mkdirSync(servicesPath, { recursive: true });
  }

  const modulesPath = path.join(backendPath, 'modules');
  if (!fs.existsSync(modulesPath)) {
    fs.mkdirSync(modulesPath, { recursive: true });
  }

  // Write files
  fs.writeFileSync(path.join(controllersPath, `${modelName.toLowerCase()}.controller.ts`), controllerCode);
  fs.writeFileSync(path.join(servicesPath, `${modelName.toLowerCase()}.service.ts`), serviceCode);
  fs.writeFileSync(path.join(modulesPath, `${modelName.toLowerCase()}.module.ts`), moduleCode);

  // Compatibility route metadata file for users expecting /routes in NestJS mode
  const routesPath = path.join(backendPath, 'routes');
  if (!fs.existsSync(routesPath)) {
    fs.mkdirSync(routesPath, { recursive: true });
  }

  const baseApiPath = `/api/${controllerBasePath}`;
  const routeManifestCode = `export const ${resourceName}RouteManifest = {
  framework: 'nestjs',
  resource: '${resourceName}',
  basePath: '${baseApiPath}',
  endpoints: [
    { method: 'GET', path: '${baseApiPath}' },
    { method: 'POST', path: '${baseApiPath}' },
    { method: 'GET', path: '${baseApiPath}/:id' },
    { method: 'PUT', path: '${baseApiPath}/:id' },
    { method: 'DELETE', path: '${baseApiPath}/:id' }
  ]
};
`;
  fs.writeFileSync(path.join(routesPath, `${resourceName}.routes.ts`), routeManifestCode);
}

function updateServerWithRoutes(backendPath, resources, config) {
  if (config.framework === 'express') {
    updateExpressServer(backendPath, resources);
  } else if (config.framework === 'fastify') {
    updateFastifyServer(backendPath, resources);
  } else if (config.framework === 'nestjs') {
    updateNestJSAppModule(backendPath, resources);
  }
}

function updateExpressServer(backendPath, resources) {
  const serverPath = path.join(backendPath, 'server.js');
  let serverCode = fs.readFileSync(serverPath, 'utf8');

  // Only update if not already updated
  if (serverCode.includes('auto-generated routes')) {
    return;
  }

  // Add imports at the top
  const importLines = resources
    .map(r => `import ${r}Router from './routes/${r}.routes.js';`)
    .join('\n');

  // Find last import line
  const lastImportMatch = serverCode.match(/import .* from .*;\n/g);
  if (lastImportMatch && lastImportMatch.length > 0) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    const lastImportIndex = serverCode.lastIndexOf(lastImport);
    serverCode = serverCode.slice(0, lastImportIndex + lastImport.length) + importLines + '\n' + serverCode.slice(lastImportIndex + lastImport.length);
  }

  // Add route registrations after health check
  const healthCheckRegex = /app\.get\('\/api\/health'[\s\S]*?\}\);/;
  const match = healthCheckRegex.exec(serverCode);
  if (match) {
    const insertPoint = match.index + match[0].length;
    const routeLines = '\n\n// Auto-generated routes\n' + resources
      .map(r => `app.use('/api/${r}', ${r}Router);`)
      .join('\n');
    serverCode = serverCode.slice(0, insertPoint) + routeLines + serverCode.slice(insertPoint);
  }

  fs.writeFileSync(serverPath, serverCode);
}

function updateFastifyServer(backendPath, resources) {
  const serverPath = path.join(backendPath, 'server.js');
  let serverCode = fs.readFileSync(serverPath, 'utf8');

  // Only update if not already updated
  if (serverCode.includes('auto-generated routes')) {
    return;
  }

  // Add imports at the top
  const importLines = resources
    .map(r => `import ${r}Routes from './routes/${r}.routes.js';`)
    .join('\n');

  // Find last import line
  const lastImportMatch = serverCode.match(/import .* from .*;\n/g);
  if (lastImportMatch && lastImportMatch.length > 0) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    const lastImportIndex = serverCode.lastIndexOf(lastImport);
    serverCode = serverCode.slice(0, lastImportIndex + lastImport.length) + importLines + '\n' + serverCode.slice(lastImportIndex + lastImport.length);
  }

  // Add route registrations after health check
  const healthCheckRegex = /fastify\.get\('\/api\/health'[\s\S]*?\}\);/;
  const match = healthCheckRegex.exec(serverCode);
  if (match) {
    const insertPoint = match.index + match[0].length;
    const routeLines = '\n\n// Auto-generated routes\n' + resources
      .map(r => `await fastify.register(${r}Routes);`)
      .join('\n');
    serverCode = serverCode.slice(0, insertPoint) + routeLines + serverCode.slice(insertPoint);
  }

  fs.writeFileSync(serverPath, serverCode);
}

function updateNestJSAppModule(backendPath, resources) {
  const appModulePath = path.join(backendPath, 'app.module.ts');
  let appModuleCode = fs.readFileSync(appModulePath, 'utf8');

  // Only update if not already updated
  if (appModuleCode.includes('auto-generated modules')) {
    return;
  }

  // Add module imports at the top
  const importLines = resources
    .map(r => {
      const modelName = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
      return `import { ${modelName}Module } from './modules/${r.toLowerCase()}.module';`;
    })
    .join('\n');

  // Find last import line
  const lastImportMatch = appModuleCode.match(/import .* from .*;\n/g);
  if (lastImportMatch && lastImportMatch.length > 0) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    const lastImportIndex = appModuleCode.lastIndexOf(lastImport);
    appModuleCode = appModuleCode.slice(0, lastImportIndex + lastImport.length) + '\n// Auto-generated modules\n' + importLines + '\n' + appModuleCode.slice(lastImportIndex + lastImport.length);
  }

  // Add modules to AppModule imports array
  const importsArrayRegex = /imports:\s*\[([\s\S]*?)\],\s*controllers:/;
  const match = importsArrayRegex.exec(appModuleCode);
  if (match) {
    const moduleNames = resources.map(r => {
      const modelName = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
      return `${modelName}Module`;
    });

    const currentImports = match[1].replace(/\s+$/, '');
    const currentWithoutTrailingComma = currentImports.replace(/,\s*$/, '');
    const moduleBlock = moduleNames.join(',\n    ');
    const nextImports = currentWithoutTrailingComma.trim().length > 0
      ? `${currentWithoutTrailingComma},\n    ${moduleBlock}`
      : `\n    ${moduleBlock}\n  `;

    appModuleCode = appModuleCode.replace(
      importsArrayRegex,
      `imports: [${nextImports}\n  ],\n  controllers:`
    );
  }

  fs.writeFileSync(appModulePath, appModuleCode);
}

// Generate SQL files for SQL databases
function generateSQLFiles(backendPath, resources, config, apiAnalysis = { relationships: [] }) {
  const sqlPath = path.join(backendPath, 'sql');
  if (!fs.existsSync(sqlPath)) {
    fs.mkdirSync(sqlPath, { recursive: true });
  }

  const dbType = config.database; // 'mysql', 'postgresql', or 'sqlite'
  
  // 01_schema.sql - CREATE TABLE statements
  let schemaSQL = generateSchemaSQL(resources, dbType, apiAnalysis);
  fs.writeFileSync(path.join(sqlPath, '01_schema.sql'), schemaSQL);
  
  // 02_crud_operations.sql - CRUD queries
  let crudSQL = generateCRUDSQL(resources, dbType, apiAnalysis);
  fs.writeFileSync(path.join(sqlPath, '02_crud_operations.sql'), crudSQL);
  
  // 03_relationships_joins.sql - JOIN queries
  let joinSQL = generateJoinSQL(resources, dbType, apiAnalysis);
  fs.writeFileSync(path.join(sqlPath, '03_relationships_joins.sql'), joinSQL);
  
  // 04_seed_data.sql - Sample data
  let seedSQL = generateSeedSQL(resources, dbType, apiAnalysis);
  fs.writeFileSync(path.join(sqlPath, '04_seed_data.sql'), seedSQL);
  
  // README.md - Instructions
  let readmeSQL = generateSQLReadme(dbType);
  fs.writeFileSync(path.join(sqlPath, 'README.md'), readmeSQL);
}

function generateSchemaSQL(resources, dbType, apiAnalysis = { relationships: [] }) {
  const isPostgres = dbType === 'postgresql';
  const isSQLite = dbType === 'sqlite';
  const isMySQL = dbType === 'mysql';
  
  let sql = `-- ============================================
-- offbyte ${dbType.toUpperCase()} Schema
-- Generated for ${dbType === 'mysql' ? 'MySQL' : dbType === 'postgresql' ? 'PostgreSQL' : 'SQLite'} Database
-- Auto-generated from detected frontend resources
-- ============================================

`;

  if (!isSQLite) {
    sql += `-- Drop existing tables (use with caution in production)\n`;

    resources.forEach((_, resourceName) => {
      sql += `DROP TABLE IF EXISTS ${resourceName}${isPostgres ? ' CASCADE' : ''};\n`;
    });
    sql += `\n`;
  }

  // Generate CREATE TABLE for each resource
  resources.forEach((resourceInfo, resourceName) => {
    const tableName = resourceName;
    const fields = resourceInfo.fields || ['name', 'description'];
    const incomingRelations = getIncomingRelationships(apiAnalysis, tableName);
    const fkFields = incomingRelations.map(rel => buildForeignKeyName(rel.parent));
    
    sql += `-- ============================================\n`;
    sql += `-- Table: ${tableName}\n`;
    sql += `-- Description: ${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} data\n`;
    sql += `-- ============================================\n`;

    const tableLines = [];
    if (isPostgres) {
      tableLines.push('    id SERIAL PRIMARY KEY');
    } else if (isSQLite) {
      tableLines.push('    id INTEGER PRIMARY KEY AUTOINCREMENT');
    } else {
      tableLines.push('    id INT AUTO_INCREMENT PRIMARY KEY');
    }

    fields.forEach(field => {
      const isRelationField = fkFields.includes(field);
      const fieldDef = isRelationField
        ? (isPostgres || isSQLite ? 'INTEGER NOT NULL' : 'INT NOT NULL')
        : getSQLFieldDefinition(field, dbType);
      tableLines.push(`    ${field} ${fieldDef}`);
    });

    fkFields.forEach(fkField => {
      if (!fields.includes(fkField)) {
        const fkType = isPostgres || isSQLite ? 'INTEGER NOT NULL' : 'INT NOT NULL';
        tableLines.push(`    ${fkField} ${fkType}`);
      }
    });

    if (isPostgres) {
      tableLines.push('    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      tableLines.push('    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    } else if (isSQLite) {
      tableLines.push('    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP');
      tableLines.push('    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP');
    } else {
      tableLines.push('    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP');
      tableLines.push('    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }

    incomingRelations.forEach(rel => {
      const fkField = buildForeignKeyName(rel.parent);
      if (isPostgres) {
        tableLines.push(`    FOREIGN KEY (${fkField}) REFERENCES ${rel.parent}(id) ON DELETE CASCADE`);
      } else if (isSQLite) {
        tableLines.push(`    FOREIGN KEY (${fkField}) REFERENCES ${rel.parent}(id) ON DELETE CASCADE`);
      } else {
        tableLines.push(`    FOREIGN KEY (${fkField}) REFERENCES ${rel.parent}(id) ON DELETE CASCADE`);
      }
    });

    if (isSQLite) {
      sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n${tableLines.join(',\n')}\n`;
    } else {
      sql += `CREATE TABLE ${tableName} (\n${tableLines.join(',\n')}\n`;
    }
    
    if (isMySQL) {
      sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
    } else {
      sql += `);\n\n`;
    }
    
    // Add indexes for common fields
    if (fields.includes('email')) {
      sql += `CREATE INDEX idx_${tableName}_email ON ${tableName}(email);\n`;
    }
    if (fields.includes('name')) {
      sql += `CREATE INDEX idx_${tableName}_name ON ${tableName}(name);\n`;
    }
    if (fields.includes('category')) {
      sql += `CREATE INDEX idx_${tableName}_category ON ${tableName}(category);\n`;
    }
    fkFields.forEach(fkField => {
      if (isSQLite) {
        sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${fkField} ON ${tableName}(${fkField});\n`;
      } else {
        sql += `CREATE INDEX idx_${tableName}_${fkField} ON ${tableName}(${fkField});\n`;
      }
    });
    sql += `\n`;
  });

  // Keep legacy relationship templates only when dedicated resources are absent
  if (resources.has('conversations') && !resources.has('messages') && !resources.has('conversation_participants')) {
    sql += generateConversationRelationships(dbType);
  }

  sql += `-- ============================================\n`;
  sql += `-- Schema created successfully!\n`;
  sql += `-- ============================================\n`;
  sql += `${isPostgres ? "SELECT 'Schema created successfully!' AS status;" : "SELECT 'Schema created successfully!' AS Status;"}\n`;
  
  return sql;
}

function getSQLFieldDefinition(fieldName, dbType) {
  const isPostgres = dbType === 'postgresql';
  const isSQLite = dbType === 'sqlite';
  
  // Detect field type based on name
  if (fieldName.endsWith('Id')) {
    return isPostgres || isSQLite ? 'INTEGER' : 'INT';
  } else if (fieldName === 'id') {
    return isPostgres || isSQLite ? 'INTEGER' : 'INT';
  } else if (fieldName === 'createdAt' || fieldName === 'updatedAt') {
    return isPostgres ? 'TIMESTAMP' : 'DATETIME';
  } else if (fieldName.includes('conversation')) {
    return isPostgres || isSQLite ? 'INTEGER' : 'INT';
  } else if (fieldName.includes('user') && fieldName.endsWith('Id')) {
    return isPostgres || isSQLite ? 'INTEGER' : 'INT';
  } else if (fieldName.includes('email')) {
    return isPostgres ? 'VARCHAR(255) UNIQUE' : 'VARCHAR(255)';
  } else if (fieldName.includes('price') || fieldName.includes('amount')) {
    return 'DECIMAL(10, 2)';
  } else if (fieldName.includes('stock') || fieldName.includes('count') || fieldName.includes('quantity')) {
    return isPostgres || isSQLite ? 'INTEGER DEFAULT 0' : 'INT DEFAULT 0';
  } else if (fieldName.includes('description') || fieldName.includes('content') || fieldName.includes('text')) {
    return 'TEXT';
  } else if (fieldName.includes('is') || fieldName.includes('has')) {
    return 'BOOLEAN DEFAULT FALSE';
  } else if (fieldName.includes('date') || fieldName.includes('time')) {
    return isPostgres ? 'TIMESTAMP' : 'DATETIME';
  } else {
    return 'VARCHAR(255)';
  }
}

function getDefaultInsertStatement(tableName, dbType) {
  if (dbType === 'mysql') {
    return `INSERT INTO ${tableName} () VALUES ();`;
  }
  return `INSERT INTO ${tableName} DEFAULT VALUES;`;
}

function getDefaultUpdateSet(dbType) {
  if (dbType === 'postgresql') {
    return '"updatedAt" = CURRENT_TIMESTAMP';
  }
  return 'updatedAt = CURRENT_TIMESTAMP';
}

function getSeedInsertStatement(tableName, dbType) {
  if (dbType === 'mysql') {
    return `INSERT INTO ${tableName} () VALUES ();`;
  }
  return `INSERT INTO ${tableName} DEFAULT VALUES;`;
}

function getIncomingRelationships(apiAnalysis, resourceName) {
  if (!apiAnalysis || !Array.isArray(apiAnalysis.relationships)) {
    return [];
  }
  return apiAnalysis.relationships.filter(rel => rel.child === resourceName);
}

function generateConversationRelationships(dbType) {
  const isPostgres = dbType === 'postgresql';
  const isSQLite = dbType === 'sqlite';
  
  let sql = `-- ============================================\n`;
  sql += `-- Relationship Tables for Conversations\n`;
  sql += `-- ============================================\n\n`;
  
  // conversation_participants table
  if (isPostgres) {
    sql += `CREATE TABLE conversation_participants (\n`;
    sql += `    id SERIAL PRIMARY KEY,\n`;
    sql += `    "conversationId" INTEGER NOT NULL,\n`;
    sql += `    "userId" INTEGER NOT NULL,\n`;
    sql += `    "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `    FOREIGN KEY ("conversationId") REFERENCES conversations(id) ON DELETE CASCADE,\n`;
    sql += `    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,\n`;
    sql += `    UNIQUE ("conversationId", "userId")\n`;
    sql += `);\n\n`;
  } else if (isSQLite) {
    sql += `CREATE TABLE IF NOT EXISTS conversation_participants (\n`;
    sql += `    id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    sql += `    conversationId INTEGER NOT NULL,\n`;
    sql += `    userId INTEGER NOT NULL,\n`;
    sql += `    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,\n`;
    sql += `    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,\n`;
    sql += `    UNIQUE (conversationId, userId)\n`;
    sql += `);\n\n`;
  } else {
    sql += `CREATE TABLE conversation_participants (\n`;
    sql += `    id INT AUTO_INCREMENT PRIMARY KEY,\n`;
    sql += `    conversationId INT NOT NULL,\n`;
    sql += `    userId INT NOT NULL,\n`;
    sql += `    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,\n`;
    sql += `    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,\n`;
    sql += `    UNIQUE KEY unique_conversation_user (conversationId, userId),\n`;
    sql += `    INDEX idx_conversationId (conversationId),\n`;
    sql += `    INDEX idx_userId (userId)\n`;
    sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
  }
  
  // messages table
  if (isPostgres) {
    sql += `CREATE TABLE messages (\n`;
    sql += `    id SERIAL PRIMARY KEY,\n`;
    sql += `    "conversationId" INTEGER NOT NULL,\n`;
    sql += `    "senderId" INTEGER NOT NULL,\n`;
    sql += `    text TEXT NOT NULL,\n`;
    sql += `    "isRead" BOOLEAN DEFAULT FALSE,\n`;
    sql += `    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `    FOREIGN KEY ("conversationId") REFERENCES conversations(id) ON DELETE CASCADE,\n`;
    sql += `    FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE CASCADE\n`;
    sql += `);\n\n`;
    sql += `CREATE INDEX idx_messages_conversationId ON messages("conversationId");\n`;
    sql += `CREATE INDEX idx_messages_senderId ON messages("senderId");\n\n`;
  } else if (isSQLite) {
    sql += `CREATE TABLE IF NOT EXISTS messages (\n`;
    sql += `    id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    sql += `    conversationId INTEGER NOT NULL,\n`;
    sql += `    senderId INTEGER NOT NULL,\n`;
    sql += `    text TEXT NOT NULL,\n`;
    sql += `    isRead BOOLEAN DEFAULT 0,\n`;
    sql += `    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,\n`;
    sql += `    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE\n`;
    sql += `);\n\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_messages_conversationId ON messages(conversationId);\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_messages_senderId ON messages(senderId);\n\n`;
  } else {
    sql += `CREATE TABLE messages (\n`;
    sql += `    id INT AUTO_INCREMENT PRIMARY KEY,\n`;
    sql += `    conversationId INT NOT NULL,\n`;
    sql += `    senderId INT NOT NULL,\n`;
    sql += `    text TEXT NOT NULL,\n`;
    sql += `    isRead BOOLEAN DEFAULT FALSE,\n`;
    sql += `    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,\n`;
    sql += `    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,\n`;
    sql += `    INDEX idx_conversationId (conversationId),\n`;
    sql += `    INDEX idx_senderId (senderId)\n`;
    sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
  }
  
  return sql;
}

function generateCRUDSQL(resources, dbType, apiAnalysis = { relationships: [] }) {
  let sql = `-- ============================================\n`;
  sql += `-- offbyte ${dbType.toUpperCase()} CRUD Operations\n`;
  sql += `-- All Create, Read, Update, Delete Queries\n`;
  sql += `-- Ready to use in your application\n`;
  sql += `-- ============================================\n\n`;
  
  resources.forEach((resourceInfo, resourceName) => {
    const fields = resourceInfo.fields || ['name'];
    const incomingRelations = getIncomingRelationships(apiAnalysis, resourceName);
    const relationFields = incomingRelations
      .map(rel => buildForeignKeyName(rel.parent))
      .filter(field => !fields.includes(field));
    const allInsertFields = [...fields, ...relationFields];
    const sampleValues = allInsertFields.map(f => generateSampleValue(f)).join(', ');
    const updateSets = allInsertFields.slice(0, 2).map(f => `${f} = ${generateSampleValue(f)}`).join(', ');
    
    sql += `-- ============================================\n`;
    sql += `-- ${resourceName.toUpperCase()} - CRUD Operations\n`;
    sql += `-- ============================================\n\n`;
    
    // CREATE
    sql += `-- CREATE: Insert new ${resourceName}\n`;
    if (allInsertFields.length === 0) {
      sql += `${getDefaultInsertStatement(resourceName, dbType)}\n\n`;
    } else {
      sql += `INSERT INTO ${resourceName} (${allInsertFields.join(', ')})\n`;
      sql += `VALUES (${sampleValues});\n\n`;
    }
    
    // READ
    sql += `-- READ: Get all ${resourceName}\n`;
    sql += `SELECT * FROM ${resourceName} ORDER BY createdAt DESC;\n\n`;
    
    sql += `-- READ: Get ${resourceName} by ID\n`;
    sql += `SELECT * FROM ${resourceName} WHERE id = 1;\n\n`;
    
    if (fields.includes('name')) {
      sql += `-- READ: Search ${resourceName} by name\n`;
      sql += `SELECT * FROM ${resourceName} WHERE name LIKE '%search%' ORDER BY name;\n\n`;
    }
    
    if (fields.includes('category')) {
      sql += `-- READ: Get ${resourceName} by category\n`;
      sql += `SELECT * FROM ${resourceName} WHERE category = 'Category1' ORDER BY name;\n\n`;
    }

    incomingRelations.forEach(rel => {
      const fkField = buildForeignKeyName(rel.parent);
      sql += `-- READ: Get ${resourceName} by ${rel.parent} relation\n`;
      sql += `SELECT * FROM ${resourceName} WHERE ${fkField} = 1 ORDER BY createdAt DESC;\n\n`;
    });
    
    // UPDATE
    sql += `-- UPDATE: Update ${resourceName}\n`;
    sql += `UPDATE ${resourceName}\n`;
    sql += `SET ${updateSets || getDefaultUpdateSet(dbType)}\n`;
    sql += `WHERE id = 1;\n\n`;
    
    // DELETE
    sql += `-- DELETE: Delete ${resourceName}\n`;
    sql += `DELETE FROM ${resourceName} WHERE id = 1;\n\n`;
  });
  
  return sql;
}

function generateSampleValue(fieldName) {
  if (fieldName.includes('email')) return "'user@example.com'";
  if (fieldName.endsWith('Id')) return '1';
  if (fieldName.includes('price')) return "99.99";
  if (fieldName.includes('stock') || fieldName.includes('quantity')) return "100";
  if (fieldName.includes('is') || fieldName.includes('has')) return "TRUE";
  if (fieldName.includes('role')) return "'user'";
  if (fieldName.includes('status')) return "'active'";
  if (fieldName.includes('category')) return "'Category1'";
  return `'Sample ${fieldName}'`;
}

function generateJoinSQL(resources, dbType, apiAnalysis = { relationships: [] }) {
  let sql = `-- ============================================\n`;
  sql += `-- offbyte ${dbType.toUpperCase()} Relationships & JOINs\n`;
  sql += `-- Complex queries with table relationships\n`;
  sql += `-- ============================================\n\n`;

  const relationships = (apiAnalysis && Array.isArray(apiAnalysis.relationships)) ? apiAnalysis.relationships : [];

  relationships.forEach(rel => {
    const fkField = buildForeignKeyName(rel.parent);
    const normalizedParam = rel.viaParam.startsWith(':') ? rel.viaParam : `:${rel.viaParam}`;
    sql += `-- Nested endpoint relation: /api/${rel.parent}/${normalizedParam}/${rel.child}\n`;
    sql += `SELECT child.*, parent.id AS parentId\n`;
    sql += `FROM ${rel.child} child\n`;
    sql += `INNER JOIN ${rel.parent} parent ON child.${fkField} = parent.id\n`;
    sql += `WHERE parent.id = 1\n`;
    sql += `ORDER BY child.createdAt DESC;\n\n`;

    sql += `-- Count ${rel.child} rows per ${rel.parent}\n`;
    sql += `SELECT parent.id, COUNT(child.id) AS ${rel.child}Count\n`;
    sql += `FROM ${rel.parent} parent\n`;
    sql += `LEFT JOIN ${rel.child} child ON child.${fkField} = parent.id\n`;
    sql += `GROUP BY parent.id\n`;
    sql += `ORDER BY parent.id DESC;\n\n`;
  });
  
  // Legacy conversation joins (only when relationship table exists)
  if (resources.has('conversations') && resources.has('users') && resources.has('conversation_participants')) {
    sql += `-- Get conversations with participant details\n`;
    sql += `SELECT c.*, u.name as userName, u.email\n`;
    sql += `FROM conversations c\n`;
    sql += `INNER JOIN conversation_participants cp ON c.id = cp.conversationId\n`;
    sql += `INNER JOIN users u ON cp.userId = u.id\n`;
    sql += `WHERE c.id = 1;\n\n`;
    
    sql += `-- Get user's all conversations\n`;
    sql += `SELECT c.*, COUNT(m.id) as messageCount\n`;
    sql += `FROM conversations c\n`;
    sql += `INNER JOIN conversation_participants cp ON c.id = cp.conversationId\n`;
    sql += `LEFT JOIN messages m ON c.id = m.conversationId\n`;
    sql += `WHERE cp.userId = 1\n`;
    sql += `GROUP BY c.id\n`;
    sql += `ORDER BY c.updatedAt DESC;\n\n`;
  }
  
  // General JOIN example
  if (resources.size > 1) {
    const [first, second] = Array.from(resources.keys()).slice(0, 2);
    const fkField = buildForeignKeyName(first);
    sql += `-- Example JOIN between ${first} and ${second}\n`;
    sql += `SELECT a.*, b.*\n`;
    sql += `FROM ${first} a\n`;
    sql += `LEFT JOIN ${second} b ON a.id = b.${fkField}\n`;
    sql += `LIMIT 10;\n\n`;
  }
  
  return sql;
}

function generateSeedSQL(resources, dbType, apiAnalysis = { relationships: [] }) {
  let sql = `-- ============================================\n`;
  sql += `-- offbyte ${dbType.toUpperCase()} Sample Data\n`;
  sql += `-- Seed data for testing and development\n`;
  sql += `-- ============================================\n\n`;
  
  sql += `-- Clear existing data (use with caution!)\n`;
  if (dbType === 'mysql') {
    sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
  }
  
  resources.forEach((_, resourceName) => {
    sql += `DELETE FROM ${resourceName};\n`;
  });
  
  if (dbType === 'mysql') {
    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
  }
  sql += `\n`;
  
  // Generate sample data for each resource
  resources.forEach((resourceInfo, resourceName) => {
    const fields = resourceInfo.fields || ['name'];
    const incomingRelations = getIncomingRelationships(apiAnalysis, resourceName);
    const relationFields = incomingRelations
      .map(rel => buildForeignKeyName(rel.parent))
      .filter(field => !fields.includes(field));
    const allInsertFields = [...fields, ...relationFields];

    sql += `-- Insert sample ${resourceName}\n`;
    if (allInsertFields.length === 0) {
      for (let i = 0; i < 5; i++) {
        sql += `${getSeedInsertStatement(resourceName, dbType)}\n`;
      }
      sql += `\n`;
      return;
    }

    sql += `INSERT INTO ${resourceName} (${allInsertFields.join(', ')}) VALUES\n`;
    for (let i = 1; i <= 5; i++) {
      const values = allInsertFields.map(f => generateSampleValue(f).replace('Sample', `Sample ${i}`)).join(', ');
      sql += `(${values})${i < 5 ? ',' : ';'}\n`;
    }
    sql += `\n`;
  });
  
  return sql;
}

function generateSQLReadme(dbType) {
  return `# SQL Files for ${dbType.toUpperCase()}

## Files Generated

- **01_schema.sql** - Database schema with CREATE TABLE statements
- **02_crud_operations.sql** - All CRUD operation queries
- **03_relationships_joins.sql** - JOIN queries for relationships
- **04_seed_data.sql** - Sample data for testing

## How to Use

### MySQL
\`\`\`bash
mysql -u root -p database_name < sql/01_schema.sql
mysql -u root -p database_name < sql/04_seed_data.sql
\`\`\`

### PostgreSQL
\`\`\`bash
psql -U postgres -d database_name -f sql/01_schema.sql
psql -U postgres -d database_name -f sql/04_seed_data.sql
\`\`\`

### SQLite
\`\`\`bash
sqlite3 database.db < sql/01_schema.sql
sqlite3 database.db < sql/04_seed_data.sql
\`\`\`

## Execute in Order

1. First run \`01_schema.sql\` to create tables
2. Then run \`04_seed_data.sql\` to insert sample data
3. Use \`02_crud_operations.sql\` as query reference
4. Use \`03_relationships_joins.sql\` for complex queries
`;
}

function createSampleResources(backendPath, config) {
  // Sample User Model
  let userModel = '';
  
  if (config.database === 'mongodb') {
    userModel = `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);`;
  } else {
    userModel = `import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
}, {
  timestamps: true
});`;
  }

  fs.writeFileSync(path.join(backendPath, 'models', 'User.js'), userModel);

  // Sample Route
  const sampleRoute = `import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Welcome to offbyte API' });
});

export default router;`;

  fs.writeFileSync(path.join(backendPath, 'routes', 'index.js'), sampleRoute);

  // Sample Controller
  const sampleController = `export const getUsers = async (req, res) => {
  try {
    // TODO: Implement user retrieval logic
    res.json({ users: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    // TODO: Implement user creation logic
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};`;

  fs.writeFileSync(path.join(backendPath, 'controllers', 'userController.js'), sampleController);

  // README
  const readme = `# offbyte Generated Backend

This is a production-ready backend generated by offbyte.

## Configuration
- Database: ${config.database}
- Framework: ${config.framework}
- Realtime Sockets: ${config.enableSocket ? 'Yes' : 'No'}
- Authentication: ${config.enableAuth ? 'Yes' : 'No'}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Update .env file
cp ../.env .env

# Start development server
npm run dev
\`\`\`

## Project Structure
- \`config/\` - Database and app configuration
- \`middleware/\` - Express middleware
- \`models/\` - Database models
- \`controllers/\` - Business logic controllers
- \`routes/\` - API route definitions
- \`services/\` - Service layer
- \`utils/\` - Utility functions
- \`validators/\` - Request validation schemas

## Available Scripts
- \`npm run dev\` - Start development server
- \`npm start\` - Start production server

## Environment Variables
See \`../.env\` for required environment variables.

Generated by offbyte âš¡`;

  fs.writeFileSync(path.join(backendPath, 'README.md'), readme);
}

