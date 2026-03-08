/**
 * Smart API Generation Mode
 * Detects resources from frontend patterns and generates full-stack APIs
 */

import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { detectResourcesFromFrontend } from '../utils/resourceDetector.js';
import { generateApiClients } from '../utils/apiClientGenerator.js';
import { injectApiCalls } from '../utils/codeInjector.js';
import { generateAdvancedCrudModel, generateAdvancedCrudRoutes } from '../generator/advancedCrudGenerator.js';

/**
 * Main Smart API Generation Function
 */
export async function generateSmartAPI(projectPath, options) {
  console.log(chalk.cyan('\nðŸŽ¯ offbyte Smart API Generation\n'));
  console.log(chalk.gray('Detecting resources from your frontend...\n'));

  const backendPath = path.join(projectPath, 'backend');

  // ========================================================
  // STEP 1: DETECT RESOURCES FROM FRONTEND
  // ========================================================
  const step1 = ora('Step 1/6: Scanning frontend for data patterns...').start();
  const resources = detectResourcesFromFrontend(projectPath);
  
  if (resources.length === 0) {
    step1.fail(chalk.yellow('No resources detected in frontend'));
    console.log(chalk.gray('\nMake sure your frontend has state variables like:'));
    console.log(chalk.gray('  const [products, setProducts] = useState([])'));
    console.log(chalk.gray('  const [users, setUsers] = useState([])'));
    return;
  }

  step1.succeed(chalk.green(`âœ… Detected ${resources.length} resources`));
  
  console.log(chalk.cyan('\nðŸ“¦ Detected Resources:\n'));
  for (const resource of resources) {
    console.log(chalk.white(`   â€¢ ${resource.name}`) + chalk.gray(` (${resource.singular})`));
    if (resource.fields.length > 0) {
      console.log(chalk.gray(`     Fields: ${resource.fields.join(', ')}`));
    }
  }
  console.log('');

  // ========================================================
  // STEP 2: CREATE BACKEND STRUCTURE
  // ========================================================
  const step2 = ora('Step 2/6: Creating backend structure...').start();
  
  const backendExists = fs.existsSync(backendPath);
  createBackendStructure(backendPath, projectPath);
  ensureValidationMiddleware(backendPath);
  if (backendExists) {
    step2.succeed('âœ… Backend structure exists and required utility files ensured');
  } else {
    step2.succeed('âœ… Backend structure created');
  }

  // ========================================================
  // STEP 3: GENERATE BACKEND MODELS
  // ========================================================
  const step3 = ora('Step 3/6: Generating backend models...').start();
  const modelsDir = path.join(backendPath, 'models');
  let modelCount = 0;

  for (const resource of resources) {
    const modelName = capitalize(resource.singular);
    const modelFile = path.join(modelsDir, `${modelName}.js`);
    
    // Only create if doesn't exist
    if (!fs.existsSync(modelFile)) {
      const modelCode = generateAdvancedCrudModel(
        resource.name,
        resource.fields,
        false,
        []
      );
      fs.writeFileSync(modelFile, modelCode, 'utf8');
      modelCount++;
    }
  }

  step3.succeed(`âœ… Generated ${modelCount} models`);

  // ========================================================
  // STEP 4: GENERATE BACKEND ROUTES
  // ========================================================
  const step4 = ora('Step 4/6: Generating backend routes...').start();
  const routesDir = path.join(backendPath, 'routes');
  let routeCount = 0;

  for (const resource of resources) {
    const routeFile = path.join(routesDir, `${resource.name}.routes.js`);
    
    // Only create if doesn't exist
    if (!fs.existsSync(routeFile)) {
      const routeCode = generateAdvancedCrudRoutes(
        resource.name,
        resource.fields,
        false,
        [],
        []
      );
      fs.writeFileSync(routeFile, routeCode, 'utf8');
      routeCount++;
    }
  }

  step4.succeed(`âœ… Generated ${routeCount} route files`);

  // ========================================================
  // STEP 5: GENERATE FRONTEND API CLIENTS
  // ========================================================
  const step5 = ora('Step 5/6: Generating frontend API clients...').start();
  
  try {
    const generatedClients = generateApiClients(projectPath, resources);
    step5.succeed(`âœ… Generated ${generatedClients.length} API client files`);
    
    console.log(chalk.cyan('\nðŸ“ Generated API Clients:\n'));
    for (const file of generatedClients) {
      console.log(chalk.gray(`   â€¢ ${file}`));
    }
    console.log('');
  } catch (error) {
    step5.fail(`Failed to generate API clients: ${error.message}`);
  }

  // ========================================================
  // STEP 6: INJECT API CALLS IN FRONTEND (Optional)
  // ========================================================
  if (options.inject !== false) {
    const step6 = ora('Step 6/6: Injecting API calls in frontend...').start();
    
    try {
      const injectedFiles = injectApiCalls(projectPath, resources);
      
      if (injectedFiles.length > 0) {
        step6.succeed(`âœ… Injected API calls in ${injectedFiles.length} files`);
        
        console.log(chalk.cyan('\nðŸ’‰ Modified Files:\n'));
        for (const file of injectedFiles.slice(0, 10)) {
          console.log(chalk.gray(`   â€¢ ${file}`));
        }
        if (injectedFiles.length > 10) {
          console.log(chalk.gray(`   ... and ${injectedFiles.length - 10} more`));
        }
        console.log('');
      } else {
        step6.succeed('âœ… No injection needed (files already up-to-date)');
      }
    } catch (error) {
      step6.warn(`Skipped injection: ${error.message}`);
    }
  } else {
    console.log(chalk.gray('   â­ï¸  Skipped frontend injection (--no-inject)\n'));
  }

  // ========================================================
  // STEP 7: UPDATE SERVER.JS
  // ========================================================
  const serverFile = path.join(backendPath, 'server.js');
  if (fs.existsSync(serverFile)) {
    updateServerWithRoutes(serverFile, resources);
  } else {
    createServerFile(backendPath, resources);
  }

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log(chalk.green('\nâœ… Smart API Generation Complete!\n'));
  
  console.log(chalk.cyan('ðŸ“‹ Generated APIs:\n'));
  for (const resource of resources) {
    console.log(chalk.white(`   ${resource.name}:`));
    console.log(chalk.gray(`      GET    /api/${resource.name}`));
    console.log(chalk.gray(`      GET    /api/${resource.name}/:id`));
    console.log(chalk.gray(`      POST   /api/${resource.name}`));
    console.log(chalk.gray(`      PUT    /api/${resource.name}/:id`));
    console.log(chalk.gray(`      DELETE /api/${resource.name}/:id`));
  }

  console.log(chalk.cyan('\nðŸš€ Next Steps:\n'));
  console.log(chalk.yellow('   1. Update backend with new APIs:'));
  console.log(chalk.green('      backendify sync\n'));
  console.log(chalk.gray('      This will generate backend routes & models for your new APIs\n'));
  console.log(chalk.yellow('   2. Start your servers:'));
  console.log(chalk.gray('      • Start MongoDB: mongod'));
  console.log(chalk.gray('      • Start backend: cd backend && npm run dev'));
  console.log(chalk.gray('      • Start frontend: npm start'));
  console.log(chalk.green('\n   Your frontend and backend will be fully connected! 🎉\n'));
}

/**
 * Create backend structure
 */
function createBackendStructure(backendPath, projectPath) {
  const dirs = ['routes', 'models', 'middleware', 'config', 'utils'];
  for (const dir of dirs) {
    const dirPath = path.join(backendPath, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  
  // Get templates directory path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templatesDir = path.join(__dirname, '..', '..', 'templates');
  
  // Copy pagination utility
  const paginationTemplate = path.join(templatesDir, 'pagination.utility.js');
  const paginationDest = path.join(backendPath, 'utils', 'pagination.js');
  if (fs.existsSync(paginationTemplate) && !fs.existsSync(paginationDest)) {
    fs.copyFileSync(paginationTemplate, paginationDest);
  }
  
  // Copy response helper
  const helperTemplate = path.join(templatesDir, 'utils.helper.js');
  const helperDest = path.join(backendPath, 'utils', 'helper.js');
  if (fs.existsSync(helperTemplate) && !fs.existsSync(helperDest)) {
    fs.copyFileSync(helperTemplate, helperDest);
  }
  
  // Copy validation schema
  const validationTemplate = path.join(templatesDir, 'validation.schema.js');
  const validationDest = path.join(backendPath, 'middleware', 'validation.js');
  if (fs.existsSync(validationTemplate) && !fs.existsSync(validationDest)) {
    fs.copyFileSync(validationTemplate, validationDest);
  }
  
  // Create .env file from template
  const envTemplate = path.join(templatesDir, '.env.template');
  const envDest = path.join(backendPath, '.env');
  if (fs.existsSync(envTemplate) && !fs.existsSync(envDest)) {
    let envContent = fs.readFileSync(envTemplate, 'utf8');
    // Replace DB_NAME placeholder with project name
    const dbName = path.basename(projectPath).toLowerCase().replace(/[^a-z0-9]/g, '-');
    envContent = envContent.replace(/<DB_NAME>/g, dbName);
    fs.writeFileSync(envDest, envContent, 'utf8');
  }
}

/**
 * Ensure validation middleware has validateErrors export expected by generated routes.
 */
function ensureValidationMiddleware(backendPath) {
  const validationFile = path.join(backendPath, 'middleware', 'validation.js');
  if (!fs.existsSync(validationFile)) return;

  const content = fs.readFileSync(validationFile, 'utf8');
  if (content.includes('export const validateErrors')) return;

  let updated = content;
  if (!updated.includes("from 'express-validator'") && !updated.includes('from "express-validator"')) {
    updated = `import { validationResult } from 'express-validator';\n\n` + updated;
  }

  const validateErrorsBlock = `export const validateErrors = (req, res, next) => {\n  const errors = validationResult(req);\n  if (!errors.isEmpty()) {\n    return res.status(400).json({\n      success: false,\n      errors: errors.array()\n    });\n  }\n  next();\n};\n\n`;

  fs.writeFileSync(validationFile, validateErrorsBlock + updated, 'utf8');
}

/**
 * Update server.js with new routes
 */
function updateServerWithRoutes(serverFile, resources) {
  let content = fs.readFileSync(serverFile, 'utf8');
  let modified = false;

  for (const resource of resources) {
    const routeImport = `import ${resource.name}Routes from './routes/${resource.name}.routes.js';`;
    const routeUse = `app.use('/api/${resource.name}', ${resource.name}Routes);`;

    // Add import if not present
    if (!content.includes(`from './routes/${resource.name}.routes.js'`)) {
      // Find last import
      const lastImportIndex = content.lastIndexOf('import ');
      const endOfLine = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfLine + 1) + routeImport + '\n' + content.slice(endOfLine + 1);
      modified = true;
    }

    // Add route use if not present
    if (!content.includes(`app.use('/api/${resource.name}'`)) {
      // Find where routes are defined (after middleware, before server/app listen)
      const appListenIndex = content.indexOf('app.listen');
      const serverListenIndex = content.indexOf('server.listen');
      const listenCandidates = [appListenIndex, serverListenIndex].filter(idx => idx !== -1);
      const listenIndex = listenCandidates.length > 0 ? Math.min(...listenCandidates) : -1;

      if (listenIndex !== -1) {
        content = content.slice(0, listenIndex) + routeUse + '\n\n' + content.slice(listenIndex);
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(serverFile, content, 'utf8');
  }
}

/**
 * Create basic server.js
 */
function createServerFile(backendPath, resources) {
  let serverCode = `import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/offbyte', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('âœ… MongoDB Connected');
}).catch((err) => {
  console.error('âŒ MongoDB Connection Failed:', err.message);
});

`;

  // Add route imports
  for (const resource of resources) {
    serverCode += `import ${resource.name}Routes from './routes/${resource.name}.routes.js';\n`;
  }

  serverCode += '\n// Routes\n';
  
  // Add route uses
  for (const resource of resources) {
    serverCode += `app.use('/api/${resource.name}', ${resource.name}Routes);\n`;
  }

  serverCode += `
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`ðŸš€ Server running on http://localhost:\${PORT}\`);
});
`;

  fs.writeFileSync(path.join(backendPath, 'server.js'), serverCode, 'utf8');
  
  // Create package.json
  const packageJson = {
    name: 'backend',
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'node server.js',
      start: 'node server.js'
    },
    dependencies: {
      express: '^4.18.0',
      mongoose: '^7.0.0',
      cors: '^2.8.5',
      dotenv: '^16.0.0',
      'express-validator': '^7.0.0'
    }
  };
  
  fs.writeFileSync(
    path.join(backendPath, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf8'
  );
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default { generateSmartAPI };

