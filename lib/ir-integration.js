/**
 * IR Integration - Connects Scanner â†’ IR â†’ Generator
 * 
 * Professional pipeline: Scan â†’ Build IR â†’ Generate Code
 */

import fs from 'fs';
import path from 'path';
import { scanFrontendCode } from './scanner/frontendScanner.js';
import { buildIR, validateIR, printIR } from './ir-builder/irBuilder.js';
import {
  generateBackendFromScanner,
  writeGeneratedFiles,
  generateBackendScaffold,
  printGenerationSummary
} from './generator/irBasedGenerator.js';

/**
 * Complete pipeline: Frontend â†’ IR â†’ Backend
 */
export async function offbyteWithIR(frontendPath, outputPath, options = {}) {
  console.log('\n' + '='.repeat(70));
  console.log('ðŸš€ offbyt - IR-Based Backend Generation');
  console.log('='.repeat(70) + '\n');

  try {
    // Step 1: Scan frontend
    console.log('ðŸ“± STEP 1: Scanning Frontend Code\n');
    const detectedApis = scanFrontendCode(frontendPath);
    
    if (detectedApis.length === 0) {
      console.warn('âš ï¸  No APIs detected. Make sure frontend has API calls.');
      return;
    }

    console.log(`âœ… Detected ${detectedApis.length} API calls\n`);

    // Step 2: Save detected APIs
    const apisPath = path.join(outputPath, 'detected-apis.json');
    if (!fs.existsSync(path.dirname(apisPath))) {
      fs.mkdirSync(path.dirname(apisPath), { recursive: true });
    }
    fs.writeFileSync(apisPath, JSON.stringify(detectedApis, null, 2));
    console.log(`ðŸ’¾ Saved API detections to: detectedapis.json\n`);

    // Step 3: Build IR
    console.log('ðŸ§  STEP 2: Building Intermediate Representation (IR)\n');
    const ir = buildIR(detectedApis, {
      hasAuth: options.hasAuth ?? true,
      dbType: options.dbType ?? 'mongodb',
      apiVersion: options.apiVersion ?? 'v1',
      projectName: options.projectName || path.basename(frontendPath)
    });

    // Validate IR
    const validation = validateIR(ir);
    if (!validation.valid) {
      console.error('âŒ IR Validation Failed:');
      validation.errors.forEach(err => console.error(`   - ${err}`));
      throw new Error('Invalid IR structure');
    }

    // Save IR
    const irPath = path.join(outputPath, 'project.ir.json');
    fs.writeFileSync(irPath, JSON.stringify(ir, null, 2));
    console.log(`ðŸ’¾ Saved IR to: project.ir.json`);

    console.log(`âœ… IR built with ${ir.resources.length} resources\n`);

    // Step 4: Generate backend
    console.log('ðŸ”¨ STEP 3: Generating Backend Code\n');
    const result = await generateBackendFromScanner(detectedApis, {
      hasAuth: options.hasAuth ?? true,
      dbType: options.dbType ?? 'mongodb'
    });

    // Step 5: Write files
    console.log('ðŸ“ STEP 4: Writing Generated Files\n');
    
    // Create models, routes, validations
    const backendDir = path.join(outputPath, 'generated');
    await writeGeneratedFiles(result.generated, backendDir);

    // Create scaffold (server.js, package.json, etc.)
    await generateBackendScaffold(result.ir, backendDir);

    // Create README
    createReadme(backendDir, ir, options);

    // Step 6: Summary
    printGenerationSummary(result);

    // Additional info
    console.log('ðŸ“Š IR Structure Breakdown:\n');
    ir.resources.forEach(resource => {
      console.log(`   ðŸ“¦ ${resource.singular}:`);
      console.log(`      Fields: ${resource.fields.map(f => f.name).join(', ')}`);
      console.log(`      Routes: ${resource.routes.join(', ')}`);
      if (resource.validations && Object.keys(resource.validations).length > 0) {
        console.log(`      Validations: ${Object.keys(resource.validations).join(', ')}`);
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log('âœ¨ GENERATION COMPLETE!');
    console.log('='.repeat(70) + '\n');

    console.log('ðŸ“‚ Generated Structure:');
    console.log(`   ${backendDir}/`);
    console.log(`   â”œâ”€â”€ models/          (Mongoose models)`);
    console.log(`   â”œâ”€â”€ routes/          (Express routes)`);
    console.log(`   â”œâ”€â”€ validations/     (Input validators)`);
    console.log(`   â”œâ”€â”€ middleware/      (Middleware handlers)`);
    console.log(`   â”œâ”€â”€ config/          (Database config)`);
    console.log(`   â”œâ”€â”€ server.js        (Express server)`);
    console.log(`   â”œâ”€â”€ package.json     (Dependencies)`);
    console.log(`   â”œâ”€â”€ .env.example     (Environment variables)`);
    console.log(`   â”œâ”€â”€ README.md        (Documentation)`);
    console.log(`   â””â”€â”€ ir-schemas/      (IR JSON files)\n`);

    console.log('ðŸš€ Next Steps:');
    console.log(`   1. cd ${backendDir}`);
    console.log(`   2. npm install`);
    console.log(`   3. Configure .env file`);
    console.log(`   4. npm run dev\n`);

    return {
      success: true,
      ir,
      generatedDir: backendDir,
      stats: {
        resourcesGenerated: ir.resources.length,
        endpointsGenerated: ir.resources.reduce((sum, r) => sum + r.endpoints.length, 0),
        fieldsDefinedGenerated: ir.resources.reduce((sum, r) => sum + r.fields.length, 0)
      }
    };

  } catch (error) {
    console.error('\nâŒ Generation Failed:');
    console.error(`   ${error.message}\n`);
    throw error;
  }
}

/**
 * Create README for generated project
 */
function createReadme(outputDir, ir, options) {
  const resources = ir.resources.map(r => 
    `- **${r.singular}** (\`${r.plural}\`): ${r.fields.map(f => f.name).join(', ')}`
  ).join('\n');

  const readme = `# Generated Backend

Auto-generated with **offbyt IR Architecture**

Generated on: ${new Date().toLocaleString()}

## ðŸ“¦ Resources

${resources}

## ðŸš€ Getting Started

\`\`\`bash
npm install
\`\`\`

### Configuration

Create a \`.env\` file (copy from \`.env.example\`):

\`\`\`env
MONGODB_URI=mongodb://localhost:27017/offbyt-${ir.settings.apiVersion}
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Server will start on \`http://localhost:3000\`

## ðŸ“š API Documentation

### Base URL

\`/api/${ir.settings.apiVersion}\`

### Endpoints

${ir.resources.map(r => {
  const endpoints = r.endpoints.map(e => {
    const method = e.method;
    const path = `/api/` + r.plural + (method === 'GET' && e.path.includes(':id') ? '/:id' : '');
    return '- `' + method + ' ' + path + '`';
  }).join('\n');
  return '#### ' + r.singular + '\n\n' + endpoints;
}).join('\n\n')}

## ðŸ”’ Authentication

${ir.settings.hasAuth ? 'Authentication is enabled. Include JWT token in Authorization header.' : 'No authentication configured.'}

## ðŸ“‚ Project Structure

\`\`\`
.
â”œâ”€â”€ models/          Mongoose schemas
â”œâ”€â”€ routes/          Express route handlers  
â”œâ”€â”€ validations/     Input validation schemas
â”œâ”€â”€ middleware/      Custom middleware
â”œâ”€â”€ config/          Database & environment config
â”œâ”€â”€ server.js        Express server entry point
â””â”€â”€ package.json     Dependencies
\`\`\`

## ðŸ”§ Customization

Generated files are ready for customization:

1. **Add Business Logic**: Edit files in \`models/\` and \`routes/\`
2. **Extend Validation**: Modify validation files
3. **Add Middleware**: Create new middleware in \`middleware/\`
4. **Database Hooks**: Add Mongoose hooks in model files

## ðŸ§ª Testing

\`\`\`bash
npm test
\`\`\`

## ðŸ“ Environment Variables

See \`.env.example\` for all configuration options.

## ðŸš€ Deployment

### Using Docker

Create \`Dockerfile\`:

\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

Build and run:

\`\`\`bash
docker build -t offbyt-app .
docker run -p 3000:3000 offbyt-app
\`\`\`

### Using Node.js

\`\`\`bash
npm install
NODE_ENV=production npm start
\`\`\`

## ðŸ“Š Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Validation**: Joi
- **Logger**: Built-in request logger

## ðŸ“„ License

Generated by offbyt IR Architecture

---

**Generated by**: offbyt  
**Generation Date**: ${new Date().toISOString()}  
**IR Version**: ${ir.version}
`;

  const readmePath = path.join(outputDir, 'README.md');
  fs.writeFileSync(readmePath, readme);
  console.log(`   âœ… ${path.relative(process.cwd(), readmePath)}`);
}

/**
 * Quick start: Directory â†’ Full Backend
 */
export async function quickGenerate(frontendPath, options = {}) {
  const projectName = path.basename(frontendPath);
  const outputPath = `./offbyt-${projectName}`;

  return offbyteWithIR(frontendPath, outputPath, {
    projectName,
    ...options
  });
}

/**
 * CLI Helper
 */
export async function runFromCLI(args) {
  const [command, frontendPath, outputPath] = args;

  if (!frontendPath) {
    console.log('\nðŸ“– Usage: node ir-integration.js <frontend-path> [output-path]\n');
    console.log('Examples:');
    console.log('  node ir-integration.js ./my-app');
    console.log('  node ir-integration.js ./frontend ./generated-backend\n');
    process.exit(1);
  }

  if (!fs.existsSync(frontendPath)) {
    console.error(`âŒ Frontend path not found: ${frontendPath}`);
    process.exit(1);
  }

  const out = outputPath || `./offbyt-${path.basename(frontendPath)}`;

  try {
    await offbyteWithIR(frontendPath, out, {
      hasAuth: true,
      projectName: path.basename(frontendPath)
    });
  } catch (error) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFromCLI(process.argv.slice(2));
}

export default offbyteWithIR;

