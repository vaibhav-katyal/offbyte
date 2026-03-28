/**
 * Enhanced Offline Mode v2.0
 * Production-Ready Backend Generation
 * Auto-exports to enhanced generator
 */

import { enhancedOfflineMode } from './offline.enhanced.js';

// Main entry point - uses enhanced production-ready generator
export async function offlineMode(projectPath) {
  return enhancedOfflineMode(projectPath);
}

export default offlineMode;

async function createBackendStructure(backendPath) {
  const dirs = [
    'routes',
    'models',
    'middleware',
    'config'
  ];

  for (const dir of dirs) {
    const dirPath = path.join(backendPath, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

/**
 * Recursively read all files in a directory
 */
function readAllFilesRecursive(dirPath) {
  const files = [];
  
  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!item.startsWith('.') && item !== 'node_modules') {
        files.push(...readAllFilesRecursive(fullPath));
      }
    } else if (
      item.endsWith('.js') || 
      item.endsWith('.jsx') || 
      item.endsWith('.ts') || 
      item.endsWith('.tsx') ||
      item.endsWith('.json')
    ) {
      try {
        files.push(fs.readFileSync(fullPath, 'utf8'));
      } catch {
        // Ignore read errors
      }
    }
  }
  
  return files;
}

async function copyMiddlewareFiles(backendPath) {
  const middlewareDir = path.join(backendPath, 'middleware');
  
  // Copy error handler
  const errorTemplate = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'errorHandler.middleware.js'),
    'utf8'
  );
  fs.writeFileSync(path.join(middlewareDir, 'errorHandler.js'), errorTemplate);

  // Copy request logger
  const loggerTemplate = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'requestLogger.middleware.js'),
    'utf8'
  );
  fs.writeFileSync(path.join(middlewareDir, 'requestLogger.js'), loggerTemplate);
}



async function installDependencies(backendPath) {
  const packageTemplate = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'package.template.json'),
    'utf8'
  );

  fs.writeFileSync(
    path.join(backendPath, 'package.json'),
    packageTemplate
  );

  // Install npm packages
  try {
    await execAsync('npm install', { cwd: backendPath });
  } catch (error) {
    console.warn('⚠️  npm install had issues, but backend is ready');
  }
}

/**
 * Generate Auth Setup (User Model + Auth Middleware + Auth Routes)
 */
async function generateAuthSetup(backendPath) {
  const middlewareDir = path.join(backendPath, 'middleware');
  const modelsDir = path.join(backendPath, 'models');
  const routesDir = path.join(backendPath, 'routes');

  // Generate standard middleware (error handler, request logger)
  await copyMiddlewareFiles(backendPath);

  // Generate auth middleware
  const authMiddlewareTemplate = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'auth.middleware.template.js'),
    'utf8'
  );
  fs.writeFileSync(path.join(middlewareDir, 'auth.js'), authMiddlewareTemplate);

  // Generate User model
  const userModelTemplate = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'auth.user.model.template.js'),
    'utf8'
  );
  fs.writeFileSync(path.join(modelsDir, 'User.js'), userModelTemplate);

  // Generate auth routes
  const authRoutesTemplate = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'auth.routes.template.js'),
    'utf8'
  );
  fs.writeFileSync(path.join(routesDir, 'auth.routes.js'), authRoutesTemplate);
}

/**
 * Generate .env file with JWT secret
 */
async function generateEnvFile(backendPath, hasAuth = false) {
  const envContent = hasAuth 
    ? generateAuthEnv()
    : fs.readFileSync(path.join(TEMPLATES_DIR, '.env.template'), 'utf8');

  fs.writeFileSync(path.join(backendPath, '.env'), envContent);
}

/**
 * Generate package.json with proper dependencies
 */
async function generatePackageJson(backendPath, hasAuth = false) {
  let packageJson = JSON.parse(
    fs.readFileSync(path.join(TEMPLATES_DIR, 'package.template.json'), 'utf8')
  );

  if (hasAuth) {
    // Ensure auth dependencies are present
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies['bcryptjs'] = '^2.4.3';
    packageJson.dependencies['jsonwebtoken'] = '^9.1.0';
  }

  fs.writeFileSync(
    path.join(backendPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

/**
 * Generate server.js with all routes (auth + CRUD)
 */
async function generateServerFile(backendPath, hasAuth = false, nonAuthResources = {}) {
  const serverTemplate = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'server.template.js'),
    'utf8'
  );

  let routeImports = '';
  let routeRegistrations = '';

  // Add auth routes if auth is enabled
  if (hasAuth) {
    routeImports += `import authRoutes from './routes/auth.routes.js';\n`;
    routeRegistrations += `app.use('/api/auth', authRoutes);\n\n`;
  }

  // Add CRUD routes for all resources
  for (const [resourceName] of Object.entries(nonAuthResources)) {
    if (resourceName === 'api') continue;
    
    const routesFile = `${resourceName}.routes.js`;
    routeImports += `import ${resourceName}Routes from './routes/${routesFile}';\n`;
    routeRegistrations += `app.use('/api/${resourceName}', ${resourceName}Routes);\n`;
  }

  const serverContent = serverTemplate.replace(
    /\/\/\s*__ROUTES__|<ROUTES>/,
    (routeImports + routeRegistrations).trim()
  );

  fs.writeFileSync(path.join(backendPath, 'server.js'), serverContent);
}

function printCompletionInfo(backendPath, hasAuth = false, generatedResources = [], allResources = {}) {
  console.log(chalk.cyan('📦 Generated Backend Structure:\n'));
  console.log(`   📁 ${chalk.bold('backend/')}`);
  console.log(`      ├── server.js              (Main Express server)`);
  console.log(`      ├── .env                   (Environment config with JWT)`);
  console.log(`      ├── package.json           (Dependencies)`);
  console.log(`      ├── 📁 routes/             (API endpoints)`);
  console.log(`      │   ${hasAuth ? '├── auth.routes.js' : ''} (Auth: signup, login, profile, logout)`.replace('├──  (', '├── auth.routes.js             (').trim());
  
  for (const resource of generatedResources) {
    const isLast = resource === generatedResources[generatedResources.length - 1];
    console.log(`      │   ${isLast ? '└' : '├'}── ${resource}.routes.js      (CRUD: List, Create, Read, Update, Delete)`);
  }
  
  console.log(`      ├── 📁 models/             (MongoDB schemas)`);
  console.log(`      │   ${hasAuth ? '├── User.js' : ''} (User with bcryptjs)`.replace('├──', hasAuth ? '├──' : '└──').trim());
  
  for (const resource of generatedResources) {
    const isLast = resource === generatedResources[generatedResources.length - 1];
    const modelName = resource.charAt(0).toUpperCase() + resource.slice(1).replace(/s$/, '');
    console.log(`      │   ${isLast && !hasAuth ? '└' : '├'}── ${modelName}.js`);
  }
  
  console.log(`      ├── 📁 middleware/         (Error handling + Logging${hasAuth ? ' + Auth' : ''})`);
  console.log(`      │   ├── errorHandler.js`);
  console.log(`      │   ├── requestLogger.js`);
  if (hasAuth) {
    console.log(`      │   └── auth.js             (JWT verification)`);
  }
  console.log(`      └── 📁 config/             (Configuration files)\n`);

  console.log(chalk.cyan('🚀 Quick Start:\n'));
  console.log(`   ${chalk.gray('$')} cd backend`);
  console.log(`   ${chalk.gray('$')} npm install  # If needed`);
  console.log(`   ${chalk.gray('$')} npm start\n`);

  console.log(chalk.cyan('📝 Generated Features:\n'));
  console.log(`   ✅ Express.js server with middleware`);
  console.log(`   ✅ MongoDB + Mongoose integration`);
  console.log(`   ✅ Auto-generated REST API routes`);
  console.log(`   ✅ Complete CRUD operations for all resources`);
  console.log(`   ✅ Error handling & request logging`);
  console.log(`   ✅ CORS enabled by default`);
  console.log(`   ✅ Environment variable support`);
  
  if (hasAuth) {
    console.log(`   ✅ JWT Authentication (7-day expiry)`);
    console.log(`   ✅ Bcrypt password hashing (10 rounds)`);
    console.log(`   ✅ User model with validation`);
    console.log(`   ✅ Auth middleware for protected routes`);
  }
  
  console.log(`   ✅ Production-ready structure\n`);

  if (generatedResources.length > 0) {
    console.log(chalk.green('📊 Generated Resources:\n'));
    for (const resource of generatedResources) {
      const modelName = resource.charAt(0).toUpperCase() + resource.slice(1).replace(/s$/, '');
      console.log(`   📦 ${modelName}`);
      console.log(`      Routes: GET /api/${resource}, POST /api/${resource}, GET /api/${resource}/:id`);
      console.log(`              PUT /api/${resource}/:id, DELETE /api/${resource}/:id`);
    }
    console.log();
  }

  if (hasAuth) {
    console.log(chalk.green('🔐 Auth Endpoints:\n'));
    console.log(`   POST   /api/auth/signup       (Register new user)`);
    console.log(`   POST   /api/auth/login        (Login with email & password)`);
    console.log(`   GET    /api/auth/profile      (Get user profile - Protected)`);
    console.log(`   PUT    /api/auth/profile      (Update profile - Protected)`);
    console.log(`   POST   /api/auth/logout       (Logout - Protected)\n`);
  }

  console.log(chalk.yellow('⚠️  Important:\n'));
  console.log(`   1. MongoDB must be running locally or use MongoDB Atlas`);
  console.log(`   2. Update .env with your database URI if needed`);
  console.log(`   3. Update MONGODB_URI in .env for production`);
  if (hasAuth) {
    console.log(`   4. JWT_SECRET is auto-generated in .env`);
  }
  console.log(`   5. Customize models in backend/models/`);
  console.log(`   6. Update routes in backend/routes/\n`);

  console.log(chalk.green.bold('🎉 Ready to Deploy!\n'));
}
