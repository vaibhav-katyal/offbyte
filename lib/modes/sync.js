// sync.js - offbyte Sync Mode
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import { scanFrontendCode } from '../scanner/frontendScanner.js';
import { extractAllApiEndpoints } from '../scanner/apiEndpointExtractor.js';
import { generateAdvancedCrudModel, generateAdvancedCrudRoutes } from '../generator/advancedCrudGenerator.js';

/**
 * Sync backend with frontend changes
 * Only adds/updates backend files for new/changed endpoints
 */
export async function syncBackendWithFrontend(projectPath) {
  const backendPath = path.join(projectPath, 'backend');
  if (!fs.existsSync(backendPath)) {
    console.log(chalk.red('âŒ Backend folder not found. Please run `offbyte generate` first.'));
    return;
  }

  // Detect database type from backend config
  const dbType = detectDatabaseType(backendPath);
  const isSQL = ['mysql', 'postgresql', 'sqlite'].includes(dbType);

  const spinner = ora('ðŸ”„ Scanning frontend for API changes...').start();
  const apiCalls = scanFrontendCode(projectPath);
  spinner.succeed(`âœ… Found ${apiCalls.length} API calls in frontend`);

  // Extract endpoints grouped by resource
  const endpointsByResource = extractAllApiEndpoints('', apiCalls);
  
  // Convert to resources Map for SQL generation
  const resources = new Map();
  const createdResources = [];

  // For each resource, check if model/route exists, else create or update/merge
  for (const resourceName in endpointsByResource) {
    const resource = endpointsByResource[resourceName];
    const modelName = resolveModelName(backendPath, resourceName);
    const modelFile = path.join(backendPath, 'models', `${modelName}.js`);
    const routeFile = path.join(backendPath, 'routes', `${resourceName}.routes.js`);

    // Store resource info for SQL generation
    resources.set(resourceName, {
      name: resourceName,
      fields: Array.from(resource.fields),
      hasAuth: resource.hasAuth
    });

    // --- MODEL SYNC ---
    if (!fs.existsSync(modelFile)) {
      if (isSQL) {
        // Generate Sequelize model for SQL databases
        const modelCode = generateSequelizeModel(resourceName, Array.from(resource.fields), resource.hasAuth);
        fs.writeFileSync(modelFile, modelCode, 'utf8');
      } else {
        // Generate Mongoose model for MongoDB
        const modelCode = generateAdvancedCrudModel(resourceName, Array.from(resource.fields), resource.hasAuth);
        fs.writeFileSync(modelFile, modelCode, 'utf8');
      }
      console.log(chalk.green(`ðŸ†• Model created: models/${modelName}.js`));
      createdResources.push(resourceName);
    } else {
      // Smart merge: add missing fields to schema at a stable insertion point.
      let modelContent = fs.readFileSync(modelFile, 'utf8');
      const missingFields = Array.from(resource.fields).filter(
        (field) => !new RegExp(`\\b${escapeRegex(field)}\\s*:`).test(modelContent)
      );

      if (missingFields.length > 0) {
        if (isSQL) {
          // Add fields to Sequelize model
          const fieldBlock = missingFields
            .map((field) => `    ${field}: {\n      type: DataTypes.STRING,\n      allowNull: true\n    },`)
            .join('\n');

          // Find insertion point before timestamps or closing brace
          if (/isActive:/.test(modelContent)) {
            modelContent = modelContent.replace(/(\n\s*)isActive:/, `\n${fieldBlock}\n$1isActive:`);
          } else if (/},\s*\{\s*timestamps:/.test(modelContent)) {
            modelContent = modelContent.replace(/(},\s*\{\s*timestamps:)/, `\n${fieldBlock}\n  $1`);
          }
        } else {
          // Add fields to Mongoose model
          const fieldBlock = missingFields
            .map((field) => `    ${field}: { type: String, trim: true },`)
            .join('\n');

          if (/\n\s*\/\/ Metadata/.test(modelContent)) {
            modelContent = modelContent.replace(/\n\s*\/\/ Metadata/, `\n${fieldBlock}\n\n    // Metadata`);
          } else if (/\n\s*isActive\s*:/.test(modelContent)) {
            modelContent = modelContent.replace(/\n\s*isActive\s*:/, `\n${fieldBlock}\n\n    isActive:`);
          } else {
            modelContent = modelContent.replace(
              /new mongoose\.Schema\s*\(\s*\{\s*/,
              (match) => `${match}\n${fieldBlock}\n`
            );
          }
        }

        fs.writeFileSync(modelFile, modelContent, 'utf8');
        missingFields.forEach((field) => {
          console.log(chalk.yellow(`âž• Field '${field}' added to models/${modelName}.js`));
        });
      }
    }

    // --- ROUTE SYNC ---
    if (!fs.existsSync(routeFile)) {
      if (isSQL) {
        // Generate Sequelize-compatible routes
        const routeCode = generateSequelizeRoutes(resourceName, Array.from(resource.fields), resource.hasAuth);
        fs.writeFileSync(routeFile, routeCode, 'utf8');
      } else {
        // Generate Mongoose routes
        const routeCode = generateAdvancedCrudRoutes(resourceName, Array.from(resource.fields), resource.hasAuth);
        fs.writeFileSync(routeFile, routeCode, 'utf8');
      }
      console.log(chalk.green(`ðŸ†• Route created: routes/${resourceName}.routes.js`));
      if (!createdResources.includes(resourceName)) {
        createdResources.push(resourceName);
      }
    } else {
      // Keep existing routes stable; sync only scaffolds missing route files.
      // Route-level AST merging will be handled in a future hardening pass.
    }
  }

  // --- UPDATE SERVER.JS WITH ROUTES ---
  if (createdResources.length > 0) {
    updateServerWithRoutes(backendPath, createdResources);
    console.log(chalk.green(`âœ… Updated server.js with ${createdResources.length} route(s)`));
  }

  // --- GENERATE SQL FILES FOR SQL DATABASES ---
  if (isSQL && resources.size > 0) {
    generateSQLScripts(backendPath, resources, dbType);
    console.log(chalk.green(`âœ… Generated SQL scripts in backend/sql/`));
  }

  console.log(chalk.cyan('\nâœ… Backend sync complete!'));
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(str) {
  if (!str) return str;
  if (str.endsWith('ies')) return `${str.slice(0, -3)}y`;
  if (str.endsWith('ses')) return str.slice(0, -2);
  if (str.endsWith('s') && !str.endsWith('ss')) return str.slice(0, -1);
  return str;
}

function resolveModelName(backendPath, resourceName) {
  const modelsDir = path.join(backendPath, 'models');
  const singularName = capitalize(singularize(resourceName));
  const pluralName = capitalize(resourceName);

  const singularPath = path.join(modelsDir, `${singularName}.js`);
  const pluralPath = path.join(modelsDir, `${pluralName}.js`);

  if (fs.existsSync(singularPath)) return singularName;
  if (fs.existsSync(pluralPath)) return pluralName;

  return singularName;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectDatabaseType(backendPath) {
  const dbConfigPath = path.join(backendPath, 'config', 'database.js');
  
  if (!fs.existsSync(dbConfigPath)) {
    return 'mongodb'; // Default
  }

  const dbConfig = fs.readFileSync(dbConfigPath, 'utf8');
  
  if (dbConfig.includes('mongoose')) {
    return 'mongodb';
  } else if (dbConfig.includes('mysql') || dbConfig.includes('dialect: \'mysql\'')) {
    return 'mysql';
  } else if (dbConfig.includes('postgresql') || dbConfig.includes('dialect: \'postgres\'')) {
    return 'postgresql';
  } else if (dbConfig.includes('sqlite') || dbConfig.includes('dialect: \'sqlite\'')) {
    return 'sqlite';
  }
  
  return 'mongodb'; // Default
}

function generateSequelizeModel(resourceName, fields = [], hasAuth = false) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).replace(/s$/, '');
  
  const fieldDefinitions = fields
    .map(field => `    ${field}: {\n      type: DataTypes.STRING,\n      allowNull: true\n    },`)
    .join('\n');

  return `import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ${modelName} = sequelize.define(
  '${modelName}',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
${fieldDefinitions}
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }
  },
  {
    tableName: '${resourceName}',
    timestamps: true,
    indexes: [
      { fields: ['isActive'] },
      { fields: ['isDeleted'] },
      { fields: ['createdAt'] }
    ],
    hooks: {
      beforeUpdate: (instance) => {
        if (instance.changed()) {
          instance.version = (instance.version || 0) + 1;
        }
      }
    }
  }
);

// Static method for soft delete
${modelName}.softDelete = async function(id) {
  return this.update(
    { isDeleted: true },
    { where: { id } }
  );
};

// Static method to find all active
${modelName}.findAllActive = async function(options = {}) {
  return this.findAll({
    where: { isActive: true, isDeleted: false },
    order: options.sort || [['createdAt', 'DESC']],
    limit: options.limit || 100,
    offset: options.skip || 0
  });
};

export default ${modelName};
`;
}

function generateSequelizeRoutes(resourceName, fields = [], hasAuth = false) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).replace(/s$/, '');

  return `import express from 'express';
import { query, body, param } from 'express-validator';
import { validateErrors } from '../middleware/validation.js';
import { ResponseHelper } from '../utils/helper.js';
import ${modelName} from '../models/${modelName}.js';
import { Op } from 'sequelize';

const router = express.Router();

// GET ALL - With pagination
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validateErrors
  ],
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows } = await ${modelName}.findAndCountAll({
        where: { isDeleted: false },
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      const pagination = {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      };

      return ResponseHelper.paginated(res, rows, pagination, '${resourceName} loaded successfully');
    } catch (error) {
      next(error);
    }
  }
);

// GET BY ID
router.get(
  '/:id',
  [param('id').isInt(), validateErrors],
  async (req, res, next) => {
    try {
      const item = await ${modelName}.findOne({
        where: { id: req.params.id, isDeleted: false }
      });

      if (!item) {
        return ResponseHelper.notFound(res, '${modelName}');
      }

      return ResponseHelper.success(res, item, 'Item retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

// CREATE
router.post(
  '/',
  async (req, res, next) => {
    try {
      const saved = await ${modelName}.create(req.body);
      return ResponseHelper.success(res, saved, '${modelName} created successfully', 201);
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const errors = error.errors.map(e => e.message);
        return ResponseHelper.validationError(res, errors);
      }
      next(error);
    }
  }
);

// UPDATE
router.put(
  '/:id',
  [param('id').isInt(), validateErrors],
  async (req, res, next) => {
    try {
      const [updatedCount] = await ${modelName}.update(
        req.body,
        { where: { id: req.params.id } }
      );

      if (updatedCount === 0) {
        return ResponseHelper.notFound(res, '${modelName}');
      }

      const updated = await ${modelName}.findByPk(req.params.id);
      return ResponseHelper.success(res, updated, '${modelName} updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

// DELETE (Soft Delete)
router.delete(
  '/:id',
  [param('id').isInt(), validateErrors],
  async (req, res, next) => {
    try {
      const [updatedCount] = await ${modelName}.update(
        { isDeleted: true },
        { where: { id: req.params.id } }
      );

      if (updatedCount === 0) {
        return ResponseHelper.notFound(res, '${modelName}');
      }

      return ResponseHelper.success(res, null, '${modelName} deleted successfully');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
`;
}

function updateServerWithRoutes(backendPath, resources) {
  const serverPath = path.join(backendPath, 'server.js');
  
  if (!fs.existsSync(serverPath)) {
    return;
  }

  let serverCode = fs.readFileSync(serverPath, 'utf8');

  // Check if already updated
  if (serverCode.includes('// Auto-generated routes')) {
    // Update existing auto-generated section
    const newImports = resources
      .map(r => `import ${r}Router from './routes/${r}.routes.js';`)
      .join('\n');
    
    const newRoutes = resources
      .map(r => `app.use('/api/${r}', ${r}Router);`)
      .join('\n');

    // Find and replace the auto-generated routes section
    const routesSectionRegex = /(\/\/ Auto-generated routes\n)([\s\S]*?)(?=\n\/\/|app\.use\(errorHandler\))/;
    if (routesSectionRegex.test(serverCode)) {
      serverCode = serverCode.replace(routesSectionRegex, `$1${newRoutes}\n`);
    }
  } else {
    // Add imports at the top (after other imports)
    const importLines = resources
      .map(r => `import ${r}Router from './routes/${r}.routes.js';`)
      .join('\n');

    const lastImportMatch = serverCode.match(/import .* from .*;\n/g);
    if (lastImportMatch && lastImportMatch.length > 0) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const lastImportIndex = serverCode.lastIndexOf(lastImport);
      serverCode = serverCode.slice(0, lastImportIndex + lastImport.length) + '\n' + importLines + serverCode.slice(lastImportIndex + lastImport.length);
    }

    // Add route registrations after health check - find the complete block
    const healthCheckRegex = /app\.get\('\/api\/health',\s*\(req,\s*res\)\s*=>\s*\{[^}]*\}\);/;
    const match = healthCheckRegex.exec(serverCode);
    if (match) {
      const insertPoint = match.index + match[0].length;
      const routeLines = '\n\n// Auto-generated routes\n' + resources
        .map(r => `app.use('/api/${r}', ${r}Router);`)
        .join('\n');
      serverCode = serverCode.slice(0, insertPoint) + routeLines + serverCode.slice(insertPoint);
    }
  }

  fs.writeFileSync(serverPath, serverCode);
}

function generateSQLScripts(backendPath, resources, dbType) {
  const sqlPath = path.join(backendPath, 'sql');
  if (!fs.existsSync(sqlPath)) {
    fs.mkdirSync(sqlPath, { recursive: true });
  }

  // Generate schema SQL
  let schemaSQL = generateSchemaSQL(resources, dbType);
  fs.writeFileSync(path.join(sqlPath, '01_schema.sql'), schemaSQL);

  // Generate README
  const readmeContent = `# SQL Scripts for ${dbType.toUpperCase()}

These SQL scripts were auto-generated by offbyte based on your frontend API calls.

## Files

1. **01_schema.sql** - Database schema (CREATE TABLE statements)
   - Run this first to create all tables
   - Contains indexes for optimal performance
   - Includes foreign key relationships

## How to Use

### MySQL
\`\`\`bash
# Option 1: MySQL Workbench
1. Open MySQL Workbench
2. Connect to your database
3. File > Run SQL Script
4. Select 01_schema.sql
5. Click Run

# Option 2: Command Line
mysql -u root -p ${process.env.DB_NAME || 'offbyte'} < sql/01_schema.sql
\`\`\`

### PostgreSQL
\`\`\`bash
# Option 1: pgAdmin
1. Open pgAdmin
2. Connect to your database
3. Tools > Query Tool
4. Open and run 01_schema.sql

# Option 2: Command Line
psql -U postgres -d ${process.env.DB_NAME || 'offbyte'} -a -f sql/01_schema.sql
\`\`\`

### SQLite
\`\`\`bash
sqlite3 database.db < sql/01_schema.sql
\`\`\`

## Important Notes

- Review the schema before running in production
- Backup your database before making changes
- Update your .env file with correct database credentials
- The schema includes soft delete functionality (isDeleted field)
`;

  fs.writeFileSync(path.join(sqlPath, 'README.md'), readmeContent);
}

function generateSchemaSQL(resources, dbType) {
  const isPostgres = dbType === 'postgresql';
  const isSQLite = dbType === 'sqlite';
  const isMySQL = dbType === 'mysql';

  let sql = `-- ============================================\n`;
  sql += `-- offbyte Auto-Generated SQL Schema\n`;
  sql += `-- Database: ${dbType.toUpperCase()}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- ============================================\n\n`;

  if (!isSQLite) {
    sql += `-- Drop existing tables (commented for safety)\n`;
    resources.forEach((_, resourceName) => {
      sql += `-- DROP TABLE IF EXISTS ${resourceName}${isPostgres ? ' CASCADE' : ''};\n`;
    });
    sql += `\n`;
  }

  // Generate CREATE TABLE for each resource
  resources.forEach((resourceInfo, resourceName) => {
    const fields = resourceInfo.fields || [];

    sql += `-- Table: ${resourceName}\n`;
    const tableLines = [];

    if (isPostgres) {
      tableLines.push('    id SERIAL PRIMARY KEY');
    } else if (isSQLite) {
      tableLines.push('    id INTEGER PRIMARY KEY AUTOINCREMENT');
    } else {
      tableLines.push('    id INT AUTO_INCREMENT PRIMARY KEY');
    }

    fields.forEach(field => {
      const fieldDef = getSQLFieldType(field, dbType);
      tableLines.push(`    ${field} ${fieldDef}`);
    });

    tableLines.push('    isActive BOOLEAN DEFAULT TRUE');
    tableLines.push('    isDeleted BOOLEAN DEFAULT FALSE');
    tableLines.push('    version INT DEFAULT 1');

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

    if (isSQLite) {
      sql += `CREATE TABLE IF NOT EXISTS ${resourceName} (\n${tableLines.join(',\n')}\n`;
    } else {
      sql += `CREATE TABLE ${resourceName} (\n${tableLines.join(',\n')}\n`;
    }

    if (isMySQL) {
      sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
    } else {
      sql += `);\n\n`;
    }

    // Add indexes
    if (fields.includes('email')) {
      sql += `CREATE INDEX idx_${resourceName}_email ON ${resourceName}(email);\n`;
    }
    if (fields.includes('name')) {
      sql += `CREATE INDEX idx_${resourceName}_name ON ${resourceName}(name);\n`;
    }
    sql += `CREATE INDEX idx_${resourceName}_isDeleted ON ${resourceName}(isDeleted);\n`;
    sql += `\n`;
  });

  sql += `-- ============================================\n`;
  sql += `-- Schema created successfully!\n`;
  sql += `-- ============================================\n`;

  return sql;
}

function getSQLFieldType(fieldName, dbType) {
  const isPostgres = dbType === 'postgresql';
  const isSQLite = dbType === 'sqlite';

  if (fieldName.endsWith('Id') || fieldName.includes('_id')) {
    return isPostgres || isSQLite ? 'INTEGER' : 'INT';
  } else if (fieldName.includes('email')) {
    return 'VARCHAR(255)';
  } else if (fieldName.includes('price') || fieldName.includes('amount')) {
    return 'DECIMAL(10, 2)';
  } else if (fieldName.includes('count') || fieldName.includes('quantity')) {
    return isPostgres || isSQLite ? 'INTEGER DEFAULT 0' : 'INT DEFAULT 0';
  } else if (fieldName.includes('description') || fieldName.includes('content')) {
    return 'TEXT';
  } else if (fieldName.includes('is') || fieldName.includes('has')) {
    return 'BOOLEAN DEFAULT FALSE';
  } else if (fieldName.includes('date') || fieldName.includes('time')) {
    return isPostgres ? 'TIMESTAMP' : 'DATETIME';
  } else {
    return 'VARCHAR(255)';
  }
}


