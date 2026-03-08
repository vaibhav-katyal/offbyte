/**
 * CRUD Code Generator
 * Generates complete CRUD model and routes for any resource
 */

export function generateCrudModel(resourceName, fields = [], hasAuth = false) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).replace(/s$/, '');
  const collectionName = resourceName.toLowerCase();

  const fieldDefinitions = generateFieldDefinitions(fields);

  return `import mongoose from 'mongoose';

const ${modelName}Schema = new mongoose.Schema(
  {
${fieldDefinitions}
  },
  {
    timestamps: true,
    collection: '${collectionName}'
  }
);

${hasAuth ? `
// Add userId reference if authenticated resources
${modelName}Schema.add({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
` : ''}

${modelName}Schema.index({ createdAt: -1 });

const ${modelName} = mongoose.model('${modelName}', ${modelName}Schema);

export default ${modelName};
`;
}

/**
 * Generate Mongoose field definitions from field names
 */
function generateFieldDefinitions(fields) {
  const fieldDefs = [];

  for (const field of fields) {
    const normalized = field.toLowerCase();

    // Determine field type based on name
    let fieldDef = '';
    if (normalized === 'email') {
      fieldDef = `    ${field}: { type: String, lowercase: true, match: /.+\\@.+\\..+/ }`;
    } else if (normalized === 'price' || normalized === 'cost' || normalized === 'rating') {
      fieldDef = `    ${field}: { type: Number, default: 0 }`;
    } else if (normalized === 'status') {
      fieldDef = `    ${field}: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' }`;
    } else if (normalized === 'views' || normalized === 'likes' || normalized === 'count') {
      fieldDef = `    ${field}: { type: Number, default: 0 }`;
    } else if (normalized === 'userid' || normalized === 'authorid' || normalized === 'postid') {
      fieldDef = `    ${field}: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }`;
    } else if (normalized === 'duedate' || normalized === 'deadline' || normalized === 'startdate') {
      fieldDef = `    ${field}: { type: Date }`;
    } else if (normalized === 'completed' || normalized === 'active' || normalized === 'published') {
      fieldDef = `    ${field}: { type: Boolean, default: false }`;
    } else if (normalized === 'tags') {
      fieldDef = `    ${field}: [{ type: String }]`;
    } else if (normalized === 'items' || normalized === 'comments' || normalized === 'reviews') {
      fieldDef = `    ${field}: [{ type: mongoose.Schema.Types.ObjectId }]`;
    } else {
      // Default to string
      fieldDef = `    ${field}: { type: String }`;
    }

    fieldDefs.push(fieldDef);
  }

  return fieldDefs.length > 0 ? fieldDefs.join(',\n') : '    _id: mongoose.Schema.Types.ObjectId';
}

/**
 * Generate action-specific routes
 * Creates routes for actions like /dashboard, /users, /analytics, /usage, etc.
 */
function generateActionRoutes(resourceName, modelName, actions = [], endpoints = [], hasAuth = false) {
  if (!actions || actions.length === 0) return '';
  
  const authMiddleware = hasAuth ? ', authenticateToken' : '';
  let routesCode = `// ===== ACTION ROUTES =====\n`;
  
  for (const action of actions) {
    const endpoint = endpoints.find(ep => ep.action === action);
    const method = endpoint ? endpoint.method : 'GET';
    const requiresAuth = endpoint ? endpoint.requiresAuth : hasAuth;
    const auth = requiresAuth ? ', authenticateToken' : '';
    
    // Generate response based on action type
    let responseData = '';
    let responseKey = action.toLowerCase();
    
    if (action === 'dashboard') {
      responseData = `
      // TODO: Implement dashboard stats logic
      const stats = {
        totalUsers: await ${modelName}.countDocuments({}),
        activeSubscriptions: 0,
        revenue: 0,
        newUsers: 0
      };
      
      res.status(200).json({
        success: true,
        stats: stats
      });`;
    } else if (action === 'users') {
      responseData = `
      // Fetch all users
      const users = await ${modelName}.find({}).sort({ createdAt: -1 });
      
      res.status(200).json({
        success: true,
        count: users.length,
        users: users
      });`;
    } else if (action === 'subscriptions') {
      responseData = `
      // TODO: Implement subscriptions logic
      const subscriptions = [];
      
      res.status(200).json({
        success: true,
        count: subscriptions.length,
        subscriptions: subscriptions
      });`;
    } else if (action === 'analytics') {
      responseData = `
      // TODO: Implement analytics logic
      const analytics = {
        dailySignups: [],
        revenue: []
      };
      
      res.status(200).json({
        success: true,
        analytics: analytics
      });`;
    } else if (action === 'usage') {
      responseData = `
      // Fetch user usage data
      const usage = {
        apiCalls: 0,
        storage: 0,
        users: 0
      };
      
      res.status(200).json({
        success: true,
        usage: usage
      });`;
    } else if (action === 'subscription') {
      responseData = `
      // Fetch user subscription
      // TODO: Implement subscription logic with actual Subscription model
      const subscription = {
        plan: 'free',
        status: 'active',
        renewalDate: new Date()
      };
      
      res.status(200).json({
        success: true,
        subscription: subscription
      });`;
    } else if (action === 'invoices') {
      responseData = `
      // Fetch user invoices
      // TODO: Implement invoices logic
      const invoices = [];
      
      res.status(200).json({
        success: true,
        count: invoices.length,
        invoices: invoices
      });`;
    } else if (action === 'settings') {
      responseData = `
      // Fetch or update user settings
      ${method === 'PUT' ? `
      const updatedSettings = req.body;
      // TODO: Save settings to database
      
      res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        settings: updatedSettings
      });` : `
      // TODO: Fetch settings from database
      const settings = {};
      
      res.status(200).json({
        success: true,
        settings: settings
      });`}`;
    } else if (action === 'status' && method === 'PUT') {
      // Special handling for /users/:id/status
      responseData = `
      const { status } = req.body;
      const item = await ${modelName}.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );
      
      res.status(200).json({
        success: true,
        message: 'Status updated successfully',
        data: item
      });`;
    } else {
      // Generic action
      responseData = `
      // TODO: Implement ${action} logic
      res.status(200).json({
        success: true,
        message: '${action} endpoint',
        ${responseKey}: []
      });`;
    }
    
    // Determine route path
    let routePath = `/${action}`;
    if (action === 'status') {
      routePath = '/:id/status';
    } else if (action === 'upgrade') {
      routePath = '/subscription/upgrade';
    }
    
    const httpMethod = method.toLowerCase();
    
    routesCode += `
router.${httpMethod}('${routePath}'${auth}, async (req, res) => {
  try {${responseData}
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing ${action}',
      error: error.message
    });
  }
});
`;
  }
  
  return routesCode;
}

/**
 * Generate CRUD routes for a resource
 */
export function generateCrudRoutes(resourceName, fields = [], hasAuth = false, actions = [], endpoints = []) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).replace(/s$/, '');
  const routePath = `/${resourceName.toLowerCase()}`;

  // Determine if this resource is user-specific (needs auth for ALL operations)
  const userSpecificResources = ['cart', 'orders', 'order'];
  const isUserSpecific = userSpecificResources.includes(resourceName.toLowerCase());
  
  // For user-specific resources, all routes need auth
  // For public resources (products, reviews, categories), only write operations need auth
  const authMiddlewareWrite = hasAuth ? ', authenticateToken' : '';
  const authMiddlewareRead = (hasAuth && isUserSpecific) ? ', authenticateToken' : '';
  
  const userIdAssignment = hasAuth ? `
    if (req.user) {
      data.userId = req.user.id;
    }` : '';

  // Determine response key for list endpoint
  // Cart -> "items", Dashboard -> "stats", Others -> resource name
  let responseKey = resourceName.toLowerCase();
  if (responseKey === 'cart') responseKey = 'items';
  else if (responseKey === 'dashboard') responseKey = 'stats';

  return `import express from 'express';
import ${modelName} from '../models/${modelName}.js';
${hasAuth ? "import { authenticateToken } from '../middleware/auth.js';" : ''}

const router = express.Router();

${generateActionRoutes(resourceName, modelName, actions, endpoints, hasAuth)}

// ===== CREATE =====
router.post('/'${authMiddlewareWrite}, async (req, res) => {
  try {
    const data = req.body;
${userIdAssignment}

    const item = new ${modelName}(data);
    await item.save();

    res.status(201).json({
      success: true,
      message: '${modelName} created successfully',
      data: item
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating ${modelName}',
      error: error.message
    });
  }
});

// ===== READ ALL (LIST) =====
router.get('/'${authMiddlewareRead}, async (req, res) => {
  try {
    const query = ${isUserSpecific && hasAuth ? "req.user ? { userId: req.user.id } : {}" : "{}"};
    const items = await ${modelName}.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      ${responseKey}: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching ${modelName}s',
      error: error.message
    });
  }
});

// ===== READ SINGLE =====
router.get('/:id'${authMiddlewareRead}, async (req, res) => {
  try {
    const item = await ${modelName}.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '${modelName} not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching ${modelName}',
      error: error.message
    });
  }
});

// ===== UPDATE =====
router.put('/:id'${authMiddlewareWrite}, async (req, res) => {
  try {
    const item = await ${modelName}.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '${modelName} not found'
      });
    }

    res.status(200).json({
      success: true,
      message: '${modelName} updated successfully',
      data: item
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating ${modelName}',
      error: error.message
    });
  }
});

// ===== DELETE =====
router.delete('/:id'${authMiddlewareWrite}, async (req, res) => {
  try {
    const item = await ${modelName}.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '${modelName} not found'
      });
    }

    res.status(200).json({
      success: true,
      message: '${modelName} deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting ${modelName}',
      error: error.message
    });
  }
});

export default router;
`;
}

/**
 * Generate server imports and route registrations
 */
export function generateServerRouteRegistration(resources, hasAuth = false) {
  const imports = [];
  const registrations = [];

  for (const [resourceName, resource] of Object.entries(resources)) {
    if (resourceName === 'api') continue; // Skip generic api resource

    const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).replace(/s$/, '');
    imports.push(`import ${resourceName}Routes from './routes/${resourceName}.routes.js';`);
    registrations.push(`app.use('/api/${resourceName}', ${resourceName}Routes);`);
  }

  let code = '';
  
  if (imports.length > 0) {
    code += '// Resource Routes\\n' + imports.join('\\n') + '\\n\\n';
  }

  if (registrations.length > 0) {
    code += '// Register Routes\\n' + registrations.join('\\n');
  }

  return code;
}

/**
 * Generate updated package.json dependencies for CRUD
 */
export function getRequiredCrudDependencies() {
  return {
    'express': '^4.18.2',
    'mongoose': '^8.0.0',
    'bcryptjs': '^2.4.3',
    'jsonwebtoken': '^9.1.0',
    'cors': '^2.8.5',
    'dotenv': '^16.3.1'
  };
}

/**
 * Validate if resource has proper CRUD structure
 */
export function validateCrudResource(resource) {
  const errors = [];

  if (!resource.name) {
    errors.push('Resource must have a name');
  }

  if (resource.methods.length === 0) {
    errors.push('Resource must have at least one HTTP method');
  }

  if (resource.fields.length === 0) {
    errors.push('Resource should have at least one field defined');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
