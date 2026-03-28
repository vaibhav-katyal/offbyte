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
import { generateSQLFiles } from './configBasedGenerator.js';
import { printSection, printStep, printSuccess, printBox, printSummary, printFooter } from '../utils/cliFormatter.js';

/**
 * Main Smart API Generation Function
 */
export async function generateSmartAPI(projectPath, options = {}) {
  // Extract config from options (passed from cli.js)
  const config = options.config || { database: 'mongodb' };
  const isSQL = ['postgresql', 'mysql', 'sqlite'].includes(config.database);
  
  printSection('Smart API Generation Engine');
  console.log(chalk.gray('Analyzing frontend & generating full-stack APIs...\n'));
  if (isSQL) {
    printSuccess(`Using ${config.database.toUpperCase()} database`);
  }

  const backendPath = path.join(projectPath, 'backend');

  // ========================================================
  // STEP 1: DETECT RESOURCES FROM FRONTEND
  // ========================================================
  printStep(1, 6, 'Scanning Frontend for Data Patterns');
  const step1 = ora('Analyzing React state and components...').start();
  const resources = detectResourcesFromFrontend(projectPath);
  
  if (resources.length === 0) {
    step1.fail(chalk.yellow('No resources detected in frontend'));
    console.log(chalk.gray('\nMake sure your frontend has state variables like:'));
    console.log(chalk.gray('  const [products, setProducts] = useState([])'));
    console.log(chalk.gray('  const [users, setUsers] = useState([])'));
    return;
  }

  step1.succeed(chalk.green('Found resources to generate APIs for'));
  
  const resourcesList = resources.map(r => `${r.name} (${r.fields.join(', ')})`);
  printBox('Detected Resources', resourcesList);

  // ========================================================
  // STEP 2: CREATE BACKEND STRUCTURE
  // ========================================================
  printStep(2, 6, 'Creating Backend Structure');
  const step2 = ora('Generating folder structure and middleware...').start();
  
  const backendExists = fs.existsSync(backendPath);
  createBackendStructure(backendPath, projectPath);
  ensureValidationMiddleware(backendPath);
  if (backendExists) {
    step2.succeed('Backend structure verified and utility files ensured');
  } else {
    step2.succeed('Backend structure created successfully');
  }

  // ========================================================
  // STEP 3: GENERATE BACKEND MODELS
  // ========================================================
  printStep(3, 6, 'Generating Backend Models');
  const step3 = ora('Creating model files for each resource...').start();
  const modelsDir = path.join(backendPath, 'models');
  let modelCount = 0;

  for (const resource of resources) {
    const modelName = capitalize(resource.singular);
    const modelFile = path.join(modelsDir, `${modelName}.js`);
    
    // Only create if doesn't exist
    if (!fs.existsSync(modelFile)) {
      const modelCode = isSQL
        ? generateSqlCrudModel(resource)
        : generateAdvancedCrudModel(
            resource.name,
            resource.fields,
            false,
            []
          );
      fs.writeFileSync(modelFile, modelCode, 'utf8');
      modelCount++;
    }
  }

  step3.succeed(`Generated ${modelCount} models`);

  // ========================================================
  // STEP 4: GENERATE BACKEND ROUTES
  // ========================================================
  printStep(4, 6, 'Generating Backend Routes');
  const step4 = ora('Creating route files for each resource...').start();
  const routesDir = path.join(backendPath, 'routes');
  let routeCount = 0;

  for (const resource of resources) {
    const routeFile = path.join(routesDir, `${resource.name}.routes.js`);
    
    // Only create if doesn't exist
    if (!fs.existsSync(routeFile)) {
      const routeCode = isSQL
        ? generateSqlCrudRoutes(resource)
        : generateAdvancedCrudRoutes(
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

  step4.succeed(`Generated ${routeCount} route files`);

  // ========================================================
  // STEP 4.5: GENERATE SQL FILES (for SQL databases only)
  // ========================================================
  if (isSQL && resources.length > 0) {
    printStep('4.5', 6, 'Generating SQL Files');
    const sqlStep = ora('Creating SQL schema and seed files...').start();
    try {
      // Convert resources array to Map format expected by generateSQLFiles
      const resourcesMap = new Map();
      for (const resource of resources) {
        resourcesMap.set(resource.name, {
          fields: resource.fields || [],
          hasAuth: false
        });
      }
      
      generateSQLFiles(backendPath, resourcesMap, config, { relationships: [] });
      sqlStep.succeed('SQL files generated in backend/sql/');
      const sqlFiles = ['01_schema.sql', '02_crud_operations.sql', '03_relationships_joins.sql', '04_seed_data.sql'];
      printBox('Created SQL Files', sqlFiles);
    } catch (error) {
      sqlStep.fail(`Failed to generate SQL files: ${error.message}`);
      console.error(chalk.red(error.stack));
    }
  }

  // ========================================================
  // STEP 5: GENERATE FRONTEND API CLIENTS
  // ========================================================
  printStep(5, 6, 'Generating Frontend API Clients');
  const step5 = ora('Creating API client modules...').start();
  
  try {
    const generatedClients = generateApiClients(projectPath, resources);
    step5.succeed(`Generated ${generatedClients.length} API client files`);
    
    if (generatedClients.length > 0) {
      printBox('Created API Clients', generatedClients.slice(0, 8));
    }
  } catch (error) {
    step5.fail(`Failed to generate API clients: ${error.message}`);
  }

  // ========================================================
  // STEP 6: INJECT API CALLS IN FRONTEND (Optional)
  // ========================================================
  if (options.inject !== false) {
    printStep(6, 6, 'Injecting API Calls in Frontend');
    const step6 = ora('Connecting frontend components to APIs...').start();
    
    try {
      const injectedFiles = injectApiCalls(projectPath, resources, {
        idField: isSQL ? 'id' : '_id'
      });
      
      if (injectedFiles.length > 0) {
        step6.succeed(`Injected API calls in ${injectedFiles.length} files`);
        
        printBox('Modified Components', injectedFiles.slice(0, 8));
      } else {
        step6.succeed('No injection needed (files already up-to-date)');
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
  printSummary('Smart API Generation Complete!', [
    `Generated ${resources.length} resources with full CRUD APIs`,
    `${isSQL ? `Using ${config.database.toUpperCase()} database` : 'MongoDB collections ready'}`,
    `Frontend components connected and injected with API calls`
  ]);
  
  const apiEndpoints = [];
  for (const resource of resources) {
    apiEndpoints.push(`${resource.name}: GET, POST, PUT, DELETE /api/${resource.name}`);
  }
  printBox('Generated API Endpoints', apiEndpoints);
  
  printFooter([
    'cd backend && npm install',
    'npm run dev (or npm run start)',
    'Frontend will auto-connect to API at http://localhost:5000'
  ]);
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
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/offbyt', {
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

function generateSqlCrudModel(resource) {
  const modelName = capitalize(resource.singular);
  const fieldLines = (resource.fields || [])
    .filter((field) => field && field !== 'id' && field !== '_id')
    .map((field) => {
      const lower = field.toLowerCase();
      if (lower.includes('amount') || lower.includes('price') || lower.includes('cost') || lower.includes('total')) {
        return `  ${field}: { type: DataTypes.DECIMAL(10, 2), allowNull: true },`;
      }
      if (lower.includes('count') || lower.includes('quantity')) {
        return `  ${field}: { type: DataTypes.INTEGER, allowNull: true },`;
      }
      if (lower.includes('is') || lower.startsWith('has')) {
        return `  ${field}: { type: DataTypes.BOOLEAN, allowNull: true },`;
      }
      return `  ${field}: { type: DataTypes.STRING, allowNull: true },`;
    });

  const fields = fieldLines.length > 0
    ? fieldLines.join('\n')
    : '  name: { type: DataTypes.STRING, allowNull: true },';

  return `import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ${modelName} = sequelize.define('${modelName}', {
${fields}
}, {
  tableName: '${resource.name}',
  timestamps: true
});

export default ${modelName};
`;
}

function generateSqlCrudRoutes(resource) {
  const modelName = capitalize(resource.singular);

  return `import express from 'express';
import { query, body, param } from 'express-validator';
import { validateErrors } from '../middleware/validation.js';
import { ResponseHelper } from '../utils/helper.js';
import ${modelName} from '../models/${modelName}.js';

const router = express.Router();

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    validateErrors
  ],
  async (req, res, next) => {
    try {
      const page = Number.parseInt(req.query.page || '1', 10);
      const limit = Number.parseInt(req.query.limit || '10', 10);
      const offset = (page - 1) * limit;

      let where = undefined;
      if (req.query.search) {
        const search = req.query.search;
        where = {};
        for (const key of Object.keys(${modelName}.rawAttributes)) {
          if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;
          where[key] = search;
          break;
        }
      }

      const result = await ${modelName}.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
      return ResponseHelper.paginated(
        res,
        result.rows,
        {
          page,
          limit,
          total: result.count,
          pages: Math.ceil(result.count / limit),
          hasMore: page * limit < result.count,
          skip: offset
        },
        '${resource.name} loaded successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id', [param('id').isInt({ min: 1 }), validateErrors], async (req, res, next) => {
  try {
    const item = await ${modelName}.findByPk(req.params.id);
    if (!item) return ResponseHelper.notFound(res, '${modelName}');
    return ResponseHelper.success(res, item, 'Item retrieved successfully');
  } catch (error) {
    next(error);
  }
});

router.post('/', [body().isObject(), validateErrors], async (req, res, next) => {
  try {
    const created = await ${modelName}.create(req.body);
    return ResponseHelper.success(res, created, '${modelName} created successfully', 201);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', [param('id').isInt({ min: 1 }), body().isObject(), validateErrors], async (req, res, next) => {
  try {
    const item = await ${modelName}.findByPk(req.params.id);
    if (!item) return ResponseHelper.notFound(res, '${modelName}');
    await item.update(req.body);
    return ResponseHelper.success(res, item, '${modelName} updated successfully');
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', [param('id').isInt({ min: 1 }), body().isObject(), validateErrors], async (req, res, next) => {
  try {
    const item = await ${modelName}.findByPk(req.params.id);
    if (!item) return ResponseHelper.notFound(res, '${modelName}');
    await item.update(req.body);
    return ResponseHelper.success(res, item, 'Partial update successful');
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', [param('id').isInt({ min: 1 }), validateErrors], async (req, res, next) => {
  try {
    const item = await ${modelName}.findByPk(req.params.id);
    if (!item) return ResponseHelper.notFound(res, '${modelName}');
    await item.destroy();
    return ResponseHelper.success(res, { id: Number.parseInt(req.params.id, 10) }, '${modelName} deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
`;
}

export default { generateSmartAPI };

