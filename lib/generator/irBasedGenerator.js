/**
 * IR-Based Generator
 * Main orchestrator: Scanner â†’ IR â†’ Templates â†’ Generated Code
 *
 * This is the professional approach used by Yeoman, create-react-app, etc.
 */

import fs from 'fs';
import path from 'path';
import { buildIR, validateIR, printIR } from '../ir-builder/irBuilder.js';
import { renderTemplate } from '../ir-builder/templateEngine.js';
import { MODEL_TEMPLATE } from '../ir-builder/templates/model.template.js';
import { ROUTES_USER_TEMPLATE } from '../ir-builder/templates/routes-user.template.js';
import { ROUTES_GENERIC_TEMPLATE } from '../ir-builder/templates/routes-generic.template.js';
import { VALIDATION_TEMPLATE } from '../ir-builder/templates/validation.template.js';

/**
 * Main entry point: Generate complete backend from scanner output
 * 
 * Usage:
 * const generated = await generateBackendFromScanner(detectedApis, options);
 */
export async function generateBackendFromScanner(detectedApis, options = {}) {
  try {
    console.log('ðŸ”„ Starting IR-based generation pipeline...\n');

    // Step 1: Build IR
    console.log('ðŸ“Š Step 1: Building Intermediate Representation (IR)...');
    const ir = buildIR(detectedApis, options);

    // Validate IR
    const validation = validateIR(ir);
    if (!validation.valid) {
      console.error('âŒ IR validation failed:');
      validation.errors.forEach(err => console.error(`  - ${err}`));
      throw new Error('Invalid IR structure');
    }
    console.log('âœ… IR built successfully');
    console.log(`   Resources: ${ir.resources.map(r => r.name).join(', ')}\n`);

    // Step 2: Generate code for each resource
    console.log('ðŸ”¨ Step 2: Generating code from templates...');
    const generated = {};

    for (const resource of ir.resources) {
      console.log(`   Generating ${resource.name}...`);

      // Use user routes template for users, generic for others
      const routesTemplate = resource.name === 'user' ? ROUTES_USER_TEMPLATE : ROUTES_GENERIC_TEMPLATE;

      generated[resource.name] = {
        model: renderTemplate(MODEL_TEMPLATE, ir, resource.name),
        routes: resource.name === 'user' ? routesTemplate : renderTemplate(routesTemplate, ir, resource.name),
        validation: renderTemplate(VALIDATION_TEMPLATE, ir, resource.name),
        ir: JSON.stringify(ir, null, 2)
      };
    }

    console.log(`âœ… Generated ${ir.resources.length} models, routes, and validators\n`);

    // Step 3: Return complete structure
    return {
      success: true,
      ir,
      generated,
      resources: ir.resources,
      metadata: {
        totalResources: ir.resources.length,
        totalEndpoints: ir.resources.reduce((sum, r) => sum + r.endpoints.length, 0),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error(`âŒ Generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Write generated files to disk
 */
export async function writeGeneratedFiles(generated, outputDir, projectType = 'express') {
  try {
    console.log(`\nðŸ“ Writing files to ${outputDir}...\n`);

    // Create directory structure
    const dirs = [
      `${outputDir}/models`,
      `${outputDir}/routes`,
      `${outputDir}/validations`,
      `${outputDir}/ir-schemas`
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   ðŸ“‚ Created ${path.relative(process.cwd(), dir)}`);
      }
    }

    // Write files
    let fileCount = 0;

    for (const [resourceName, code] of Object.entries(generated)) {
      if (typeof code === 'object') {
        // Model
        const modelPath = `${outputDir}/models/${capitalize(resourceName)}.model.js`;
        fs.writeFileSync(modelPath, code.model);
        console.log(`   âœ… ${path.relative(process.cwd(), modelPath)}`);
        fileCount++;

        // Routes
        const routesPath = `${outputDir}/routes/${resourceName}.routes.js`;
        fs.writeFileSync(routesPath, code.routes);
        console.log(`   âœ… ${path.relative(process.cwd(), routesPath)}`);
        fileCount++;

        // Validation
        const validationPath = `${outputDir}/validations/${resourceName}.validation.js`;
        fs.writeFileSync(validationPath, code.validation);
        console.log(`   âœ… ${path.relative(process.cwd(), validationPath)}`);
        fileCount++;

        // IR Schema (for reference)
        const schemaPath = `${outputDir}/ir-schemas/${resourceName}.ir.json`;
        fs.writeFileSync(schemaPath, code.ir);
        fileCount++;
      }
    }

    console.log(`\nâœ… Generated ${fileCount} files successfully!\n`);
    return { success: true, filesWritten: fileCount };
  } catch (error) {
    console.error(`âŒ Failed to write files: ${error.message}`);
    throw error;
  }
}

/**
 * Generate complete backend structure (scaffold)
 */
export async function generateBackendScaffold(ir, outputDir) {
  const scaffoldFiles = {
    'server.js': generateServerFile(ir),
    'package.json': generatePackageJson(ir),
    '.env.example': generateEnvFile(ir),
    'config/db.js': generateDbConfig(ir),
    'middleware/errorHandler.js': generateErrorHandler(),
    'middleware/requestLogger.js': generateRequestLogger()
  };

  console.log('\nðŸ—ï¸  Creating backend scaffold...\n');

  for (const [filePath, content] of Object.entries(scaffoldFiles)) {
    const fullPath = `${outputDir}/${filePath}`;
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
    console.log(`   âœ… ${path.relative(process.cwd(), fullPath)}`);
  }

  console.log('\nâœ… Backend scaffold created!\n');
}

/**
 * Helper: Generate server.js
 */
function generateServerFile(ir) {
  const imports = ir.resources
    .map(r => `import ${capitalize(r.singular)}Routes from './routes/${r.name}.routes.js';`)
    .join('\n');

  const mountRoutes = ir.resources
    .map(r => `app.use('/api/${r.plural}', ${capitalize(r.singular)}Routes);`)
    .join('\n');

  return `import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('âœ… Connected to MongoDB'))
  .catch(err => console.error('âŒ MongoDB connection failed:', err));

// Routes
${imports}

${mountRoutes}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`ðŸš€ Server running on port \${PORT}\`);
});
`;
}

/**
 * Helper: Generate package.json
 */
function generatePackageJson(ir) {
  const pkg = {
    name: 'offbyte-generated',
    version: '1.0.0',
    type: 'module',
    scripts: {
      start: 'node server.js',
      dev: 'nodemon server.js',
      test: 'echo "Error: no test specified" && exit 1'
    },
    dependencies: {
      express: '^4.18.0',
      mongoose: '^8.0.0',
      cors: '^2.8.5',
      dotenv: '^16.3.1',
      joi: '^17.11.0'
    },
    devDependencies: {
      nodemon: '^3.0.1'
    }
  };

  return JSON.stringify(pkg, null, 2);
}

/**
 * Helper: Generate .env file
 */
function generateEnvFile(ir) {
  return `# Database
MONGODB_URI=mongodb://localhost:27017/offbyte-${ir.settings.apiVersion}

# Server
PORT=3000
NODE_ENV=development

# API
API_VERSION=${ir.settings.apiVersion || 'v1'}

# Auth (if needed)
JWT_SECRET=your-secret-key-here
`;
}

/**
 * Helper: Generate database config
 */
function generateDbConfig(ir) {
  return `import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('âœ… MongoDB connected');
  } catch (error) {
    console.error('âŒ MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
`;
}

/**
 * Helper: Generate error handler
 */
function generateErrorHandler() {
  return `export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(\`[\${new Date().toISOString()}] \${status} - \${message}\`);

  res.status(status).json({
    success: false,
    status,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
`;
}

/**
 * Helper: Generate request logger
 */
function generateRequestLogger() {
  return `export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      \`[\${new Date().toISOString()}] \${req.method} \${req.path} - \${res.statusCode} (\${duration}ms)\`
    );
  });

  next();
};
`;
}

/**
 * Helper: Capitalize
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Print generation summary
 */
export function printGenerationSummary(result) {
  console.log('\n' + '='.repeat(60));
  console.log('ðŸŽ‰ BACKEND GENERATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`\nðŸ“Š Generated Resources:`);

  result.resources.forEach(resource => {
    console.log(`\n   ${capitalize(resource.singular)}:`);
    console.log(`     â€¢ Model: ${resource.name}.model.js`);
    console.log(`     â€¢ Routes: ${resource.name}.routes.js`);
    console.log(`     â€¢ Validation: ${resource.name}.validation.js`);
    console.log(`     â€¢ Fields: ${resource.fields.map(f => f.name).join(', ')}`);
    console.log(`     â€¢ Endpoints: ${resource.endpoints.map(e => `${e.method} ${e.path}`).join(', ')}`);
  });

  console.log(`\nðŸ“ˆ Statistics:`);
  console.log(`   â€¢ Total Resources: ${result.metadata.totalResources}`);
  console.log(`   â€¢ Total Endpoints: ${result.metadata.totalEndpoints}`);
  console.log(`   â€¢ Generated At: ${result.metadata.timestamp}`);
  console.log('\n' + '='.repeat(60) + '\n');
}

