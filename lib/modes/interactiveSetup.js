/**
 * Interactive Setup Module
 * Guides users through configuration selection
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

export async function getInteractiveSetup() {
  console.log(chalk.cyan('\n╔════════════════════════════════════════╗'));
  console.log(chalk.cyan('║  offbyt - Interactive Setup        ║'));
  console.log(chalk.cyan('╚════════════════════════════════════════╝\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'database',
      message: '📦 Select Database:',
      choices: [
        { name: 'MongoDB (Mongoose)', value: 'mongodb' },
        { name: 'PostgreSQL (Sequelize)', value: 'postgresql' },
        { name: 'MySQL (Sequelize)', value: 'mysql' },
        { name: 'SQLite (Sequelize)', value: 'sqlite' }
      ],
      default: 'mongodb'
    },
    {
      type: 'list',
      name: 'framework',
      message: '⚙️  Select Backend Framework:',
      choices: [
        { name: 'Express.js (Recommended)', value: 'express' },
        { name: 'Fastify (High Performance)', value: 'fastify' },
        { name: 'NestJS (Enterprise)', value: 'nestjs' }
      ],
      default: 'express'
    },
    {
      type: 'confirm',
      name: 'enableSocket',
      message: '🔌 Enable Realtime Sockets?',
      default: true
    },
    {
      type: 'confirm',
      name: 'enableAuth',
      message: '🔐 Generate Authentication System?',
      default: true
    },
    {
      type: 'list',
      name: 'authType',
      message: '🔑 Select Authentication Type:',
      choices: [
        { name: 'JWT (JSON Web Token)', value: 'jwt' },
        { name: 'OAuth 2.0', value: 'oauth' },
        { name: 'Session-Based', value: 'session' }
      ],
      when: (answers) => answers.enableAuth,
      default: 'jwt'
    },
    {
      type: 'confirm',
      name: 'enableValidation',
      message: '✅ Enable Request Validation (Joi)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'enableCaching',
      message: '⚡ Enable Redis Caching?',
      default: false
    },
    {
      type: 'confirm',
      name: 'enableLogging',
      message: '📊 Enable Advanced Logging?',
      default: true
    }
  ]);

  return answers;
}

/**
 * Display configuration summary
 */
export function displaySetupSummary(config) {
  console.log(chalk.cyan('\n✨ Configuration Summary:\n'));
  console.log(chalk.green(`  ✔ Database        → ${formatDatabase(config.database)}`));
  console.log(chalk.green(`  ✔ Framework       → ${formatFramework(config.framework)}`));
  console.log(chalk.green(`  ✔ Realtime Socket → ${config.enableSocket ? 'Enabled' : 'Disabled'}`));
  console.log(chalk.green(`  ✔ Authentication  → ${config.enableAuth ? `Enabled (${formatAuth(config.authType)})` : 'Disabled'}`));
  console.log(chalk.green(`  ✔ Validation      → ${config.enableValidation ? 'Enabled' : 'Disabled'}`));
  console.log(chalk.green(`  ✔ Caching         → ${config.enableCaching ? 'Enabled (Redis)' : 'Disabled'}`));
  console.log(chalk.green(`  ✔ Logging         → ${config.enableLogging ? 'Enabled' : 'Disabled'}`));
  console.log(chalk.cyan('\n'));
}

function formatDatabase(db) {
  const map = {
    'mongodb': 'MongoDB (Mongoose)',
    'postgresql': 'PostgreSQL (Sequelize)',
    'mysql': 'MySQL (Sequelize)',
    'sqlite': 'SQLite (Sequelize)'
  };
  return map[db] || db;
}

function formatFramework(fw) {
  const map = {
    'express': 'Express.js',
    'fastify': 'Fastify',
    'nestjs': 'NestJS'
  };
  return map[fw] || fw;
}

function formatAuth(auth) {
  const map = {
    'jwt': 'JWT',
    'oauth': 'OAuth 2.0',
    'session': 'Session-Based'
  };
  return map[auth] || auth;
}

/**
 * Generate dependencies based on configuration
 */
export function generateDependencies(config) {
  const dependencies = {
    // Shared runtime dependency
    'dotenv': '^16.0.3'
  };

  // Framework-specific
  if (config.framework === 'express') {
    Object.assign(dependencies, {
      'express': '^4.18.2',
      'cors': '^2.8.5',
      'helmet': '^7.0.0'
    });
  } else if (config.framework === 'fastify') {
    Object.assign(dependencies, {
      'fastify': '^4.21.0',
      '@fastify/cors': '^8.4.2',
      '@fastify/helmet': '^11.1.1'
    });
  } else if (config.framework === 'nestjs') {
    Object.assign(dependencies, {
      '@nestjs/common': '^10.2.8',
      '@nestjs/config': '^3.2.3',
      '@nestjs/core': '^10.2.8',
      '@nestjs/platform-express': '^10.2.8',
      'reflect-metadata': '^0.1.13',
      'rxjs': '^7.8.1'
    });
  }

  // Database
  if (config.database === 'mongodb') {
    Object.assign(dependencies, {
      'mongoose': '^7.5.0'
    });
    if (config.framework === 'nestjs') {
      dependencies['@nestjs/mongoose'] = '^10.0.2';
    }
  } else if (['postgresql', 'mysql', 'sqlite'].includes(config.database)) {
    if (config.framework === 'nestjs') {
      Object.assign(dependencies, {
        '@nestjs/typeorm': '^10.0.1',
        'typeorm': '^0.3.17'
      });
    } else {
      Object.assign(dependencies, {
        'sequelize': '^6.33.0',
        'sequelize-cli': '^6.6.0'
      });
    }

    if (config.database === 'postgresql') {
      dependencies['pg'] = '^8.11.1';
      if (config.framework !== 'nestjs') {
        dependencies['pg-hstore'] = '^2.3.4';
      }
    } else if (config.database === 'mysql') {
      dependencies['mysql2'] = '^3.6.0';
    } else if (config.database === 'sqlite') {
      dependencies['sqlite3'] = '^5.1.6';
    }
  }

  // Optional features
  if (config.enableSocket) {
    Object.assign(dependencies, {
      'socket.io': '^4.6.1',
      'redis': '^4.6.10'
    });
  }

  if (config.enableAuth && config.authType === 'jwt') {
    Object.assign(dependencies, {
      'jsonwebtoken': '^9.0.2',
      'bcryptjs': '^2.4.3'
    });
  } else if (config.enableAuth && config.authType === 'oauth') {
    Object.assign(dependencies, {
      'passport': '^0.6.0',
      'passport-google-oauth20': '^2.0.0',
      'passport-facebook': '^3.0.0'
    });
  }

  if (config.enableValidation) {
    if (config.framework === 'nestjs') {
      Object.assign(dependencies, {
        'class-validator': '^0.14.0',
        'class-transformer': '^0.5.1'
      });
    } else {
      dependencies['joi'] = '^17.10.0';
    }
  }

  if (config.enableCaching) {
    Object.assign(dependencies, {
      'redis': '^4.6.10',
      'ioredis': '^5.3.2'
    });
  }

  if (config.enableLogging) {
    Object.assign(dependencies, {
      'winston': '^3.10.0',
      'morgan': '^1.10.0'
    });
  }

  return dependencies;
}

/**
 * Get database connection template based on type
 */
export function getDatabaseConnectionTemplate(config) {
  if (config.database === 'mongodb') {
    return `
import mongoose from 'mongoose';

export async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/offbyt';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
}
`;
  } else if (config.database === 'postgresql') {
    return `
import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'offbyt',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL Connected');
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error('❌ PostgreSQL Connection Error:', error.message);
    process.exit(1);
  }
}
`;
  } else if (config.database === 'mysql') {
    return `
import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'offbyt',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connected');
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error('❌ MySQL Connection Error:', error.message);
    process.exit(1);
  }
}
`;
  } else if (config.database === 'sqlite') {
    return `
import { Sequelize } from 'sequelize';
import path from 'path';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(process.cwd(), 'database.sqlite'),
  logging: false,
});

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ SQLite Connected');
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error('❌ SQLite Connection Error:', error.message);
    process.exit(1);
  }
}
`;
  }
}

/**
 * Get env file template
 */
export function getEnvTemplate(config) {
  let env = `# ========================================
# offbyt Production-Ready Configuration
# ========================================
# WARNING: Never commit this file to version control!
# Add .env to your .gitignore immediately

# ========================================
# Server Configuration
# ========================================
NODE_ENV=development
PORT=5000
DEBUG=true

# Server URL (Update in production)
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

# ========================================
# Database Configuration
# ========================================
`;

  if (config.database === 'mongodb') {
    env += `# MongoDB
MONGODB_URI=mongodb://localhost:27017/offbyt
# For MongoDB Atlas (Production):
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/offbyt?retryWrites=true&w=majority
MONGODB_OPTIONS=retryWrites=true&w=majority
`;
  } else if (config.database === 'postgresql') {
    env += `# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=offbyt
DB_USER=postgres
DB_PASSWORD=password
# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_SSL=false
`;
  } else if (config.database === 'mysql') {
    env += `# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=offbyt
DB_USER=root
DB_PASSWORD=password
# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_SSL=false
`;
  } else if (config.database === 'sqlite') {
    env += `# SQLite (Auto-created)
SQLITE_PATH=./database.sqlite
`;
  }

  if (config.enableAuth && config.authType === 'jwt') {
    env += `
# ========================================
# JWT Authentication
# ========================================
# CRITICAL: Generate strong secret in production!
# Use: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_jwt_secret_key_here_CHANGE_IN_PRODUCTION_use_64_chars_minimum
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_token_secret_DIFFERENT_from_access_token
JWT_REFRESH_EXPIRE=30d

# Token Settings
ACCESS_TOKEN_EXPIRE=15m
REFRESH_TOKEN_EXPIRE=30d
`;
  } else if (config.enableAuth && config.authType === 'oauth') {
    env += `
# ========================================
# OAuth Configuration
# ========================================
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5000/auth/facebook/callback
`;
  } else if (config.enableAuth && config.authType === 'session') {
    env += `
# ========================================
# Session Configuration
# ========================================
SESSION_SECRET=your_session_secret_CHANGE_IN_PRODUCTION
SESSION_NAME=offbyt.sid
SESSION_MAX_AGE=86400000
SESSION_SECURE=false
`;
  }

  if (config.enableCaching) {
    env += `
# ========================================
# Redis Cache Configuration
# ========================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_TTL=3600
`;
  }

  // Security Settings
  env += `
# ========================================
# Security Configuration
# ========================================
# CORS Settings
CORS_ORIGIN=http://localhost:3000
# For multiple origins: https://app.com,https://admin.app.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Request Size Limits
MAX_JSON_SIZE=10mb
MAX_URL_ENCODED_SIZE=10mb
MAX_FILE_SIZE=50mb

# Security Headers
HELMET_ENABLED=true
`;

  // Email Settings (if applicable)
  if (config.emailService) {
    env += `
# ========================================
# Email Configuration
# ========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourapp.com
`;
  }

  // Logging
  env += `
# ========================================
# Logging Configuration
# ========================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_ERROR_FILE=./logs/error.log
`;

  // API Keys & External Services
  env += `
# ========================================
# External Services & API Keys
# ========================================
# Add your API keys here
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# STRIPE_SECRET_KEY=
# SENDGRID_API_KEY=
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
`;

  // Production Reminder
  env += `
# ========================================
# PRODUCTION DEPLOYMENT CHECKLIST
# ========================================
# [ ] Change NODE_ENV to 'production'
# [ ] Generate secure JWT_SECRET (64+ characters)
# [ ] Update database credentials
# [ ] Set proper CORS_ORIGIN
# [ ] Enable rate limiting
# [ ] Configure HTTPS
# [ ] Set SESSION_SECURE=true (if using sessions)
# [ ] Review and update all API keys
# [ ] Setup monitoring and logging
# [ ] Configure backup strategy
# [ ] Test error handling
`;

  return env;
}


