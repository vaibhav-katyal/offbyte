/**
 * Advanced CRUD Code Generator
 * Generates production-ready CRUD operations with:
 * - Pagination, filtering, sorting, search
 * - Bulk operations
 * - Advanced validation
 * - Proper error handling
 */

export function generateAdvancedCrudModel(resourceName, fields = [], hasAuth = false, relations = []) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).replace(/s$/, '');
  const collectionName = resourceName.toLowerCase();

  // Debug logging
  console.log(`\n[DEBUG] Generating model for: ${resourceName}`);
  console.log(`[DEBUG] Model name: ${modelName}`);
  console.log(`[DEBUG] Fields: ${JSON.stringify(fields)}`);
  console.log(`[DEBUG] Relations: ${JSON.stringify(relations)}`);

  const fieldDefinitions = generateAdvancedFieldDefinitions(fields, relations);
  console.log(`[DEBUG] Field definitions generated (length: ${fieldDefinitions.length} chars)`);
  
  const indexes = generateIndexes(fields, modelName);

  return `import mongoose from 'mongoose';

const ${modelName}Schema = new mongoose.Schema(
  {
${fieldDefinitions},
    // Metadata
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    metadata: {
      createdBy: mongoose.Schema.Types.ObjectId,
      updatedBy: mongoose.Schema.Types.ObjectId,
      version: { type: Number, default: 1 },
      tags: [String]
    }
  },
  {
    timestamps: true,
    collection: '${collectionName}'
  }
);

// ============================================================
// INDEXES FOR PERFORMANCE
// ============================================================
${indexes}

// ============================================================
// HOOKS
// ============================================================

${modelName}Schema.pre('save', function(next) {
  if (this.isModified()) {
    this.metadata.version = (this.metadata.version || 0) + 1;
  }
  next();
});

// ============================================================
// QUERY HELPERS
// ============================================================

${modelName}Schema.query.active = function() {
  return this.find({ isActive: true, isDeleted: false });
};

// ============================================================
// STATIC METHODS
// ============================================================

${modelName}Schema.statics.findAllActive = async function(options = {}) {
  return this.find({ isActive: true, isDeleted: false })
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);
};

${modelName}Schema.statics.softDelete = async function(id) {
  return this.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );
};

// ============================================================
// INSTANCE METHODS
// ============================================================

${modelName}Schema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const ${modelName} = mongoose.model('${modelName}', ${modelName}Schema);

export default ${modelName};
`;
}

function generateAdvancedFieldDefinitions(fields, relations = []) {
  const fieldDefs = [];
  const relationMap = new Map(relations.map(r => [r.field, r]));

  for (const field of fields) {
    // Skip MongoDB's automatic _id field and id variations
    if (field === '_id' || field === 'id' || field.toLowerCase() === 'id') {
      continue;
    }

    const normalized = field.toLowerCase();
    const relation = relationMap.get(field);
    
    let fieldDef = '';

    // Check if this field has a defined relation
    if (relation) {
      fieldDef = `    ${field}: { type: mongoose.Schema.Types.ObjectId, ref: '${relation.ref}', required: ${relation.required || false} }`;
    }
    // Email
    else if (normalized.includes('email')) {
      fieldDef = `    ${field}: { type: String, match: /.+@.+\\..+/, unique: true, sparse: true, lowercase: true, trim: true }`;
    }
    // Price/Amount/Cost
    else if (normalized.match(/^(price|cost|amount|total|revenue|salary)$/)) {
      fieldDef = `    ${field}: { type: Number, min: 0, default: 0 }`;
    }
    // Rating/Score
    else if (normalized.match(/^(rating|score|points?)$/)) {
      fieldDef = `    ${field}: { type: Number, min: 0, max: 100, default: 0 }`;
    }
    // Status
    else if (normalized === 'status') {
      fieldDef = `    ${field}: { type: String, enum: ['active', 'inactive', 'pending', 'archived', 'draft'], default: 'active' }`;
    }
    // Count/Views/Likes
    else if (normalized.match(/^(count|views|likes|clicks|impressions)$/)) {
      fieldDef = `    ${field}: { type: Number, default: 0, min: 0 }`;
    }
    // Boolean flags
    else if (normalized.match(/^(is_|active|published|completed|verified|confirmed)/) || 
             normalized.match(/(active|published|completed|verified|confirmed)$/i)) {
      fieldDef = `    ${field}: { type: Boolean, default: false, index: true }`;
    }
    // Date fields
    else if (normalized.match(/date|time|at$/)) {
      fieldDef = `    ${field}: { type: Date, default: Date.now }`;
    }
    // Phone
    else if (normalized.includes('phone')) {
      fieldDef = `    ${field}: { type: String, match: /^\\+?[\\d\\s\\-()]+$/ }`;
    }
    // Arrays
    else if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
      fieldDef = `    ${field}: [{ type: String }]`;
    }
    // Default to string
    else {
      fieldDef = `    ${field}: { type: String, trim: true }`;
    }

    fieldDefs.push(fieldDef);
  }

  return fieldDefs.length > 0 ? fieldDefs.join(',\n') : '    // Fields defined';
}

function generateIndexes(fields, modelName) {
  const indexes = [
    `${modelName}Schema.index({ createdAt: -1 });`,
    `${modelName}Schema.index({ updatedAt: -1 });`,
    `${modelName}Schema.index({ isActive: 1 });`,
    `${modelName}Schema.index({ isDeleted: 1, createdAt: -1 });`
  ];

  // Add indexes for common query fields
  for (const field of fields) {
    const normalized = field.toLowerCase();
    if (normalized.match(/^(status|type|category|user|owner)$/)) {
      indexes.push(`${modelName}Schema.index({ ${field}: 1, createdAt: -1 });`);
    }
  }

  return indexes.join('\n');
}

/**
 * Generate Advanced Routes with Pagination, Filtering, Sorting
 */
export function generateAdvancedCrudRoutes(resourceName, fields = [], hasAuth = false, relations = [], actions = []) {
  const modelName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1).replace(/s$/, '');
  const searchFields = fields.filter(f => 
    !f.toLowerCase().match(/^(id|createdby|lastupdated)$/)
  ).slice(0, 3).join("', '");

  const filterFields = fields.filter(f =>
    f.toLowerCase().match(/^(status|type|category|isactive)$/)
  ).map(f => `'${f}'`).join(', ');

  // Debug logging
  console.log(`\n[DEBUG] Generating routes for: ${resourceName}`);
  console.log(`[DEBUG] Model name: ${modelName}`);
  console.log(`[DEBUG] Fields: ${JSON.stringify(fields)}`);
  console.log(`[DEBUG] Search fields string: "${searchFields}"`);
  console.log(`[DEBUG] Filter fields string: "${filterFields}"`);

  const validators = generateValidators(fields);
  const updateValidators = generateUpdateValidators(fields);

  return `import express from 'express';
import { query, body, param } from 'express-validator';
import { validateErrors } from '../middleware/validation.js';
import { PaginationHelper } from '../utils/pagination.js';
import { ResponseHelper } from '../utils/helper.js';
import ${modelName} from '../models/${modelName}.js';

const router = express.Router();

// ============================================================
// GET ALL - WITH PAGINATION, FILTERING, SORTING, SEARCH
// ============================================================
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sort').optional().isString(),
    query('search').optional().isString().trim(),
    validateErrors
  ],
  async (req, res, next) => {
    try {
      const { page = 1, limit = 10, skip = 0 } = PaginationHelper.getPaginationParams(req);
      const sort = PaginationHelper.getSortObject(req.query.sort);

      let query = {};

      // Apply search filter
      if (req.query.search) {
        query = PaginationHelper.buildSearchQuery(req.query.search, ['${searchFields}']);
      }

      // Apply additional filters
      const filters = PaginationHelper.buildFilterQuery(req, [${filterFields}]);
      query = { ...query, ...filters };

      // Exclude deleted items by default
      query.isDeleted = false;

      // Execute paginated query
      const result = await PaginationHelper.paginate(${modelName}, query, { page, limit, skip, sort });

      return ResponseHelper.paginated(res, result.data, result.pagination, '${resourceName} loaded successfully');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// GET BY ID
// ============================================================
router.get(
  '/:id',
  [param('id').isMongoId(), validateErrors],
  async (req, res, next) => {
    try {
      const item = await ${modelName}.findOne({ _id: req.params.id, isDeleted: false });

      if (!item) {
        return ResponseHelper.notFound(res, '${modelName}');
      }

      return ResponseHelper.success(res, item, 'Item retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// CREATE
// ============================================================
router.post(
  '/',
  [${validators ? validators + ', ' : ''}validateErrors],
  async (req, res, next) => {
    try {
      const newItem = new ${modelName}(req.body);
      const saved = await newItem.save();

      return ResponseHelper.success(res, saved, '${modelName} created successfully', 201);
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(e => e.message);
        return ResponseHelper.validationError(res, errors);
      }
      if (error.code === 11000) {
        return ResponseHelper.error(res, 'Duplicate value for unique field', [], 409);
      }
      next(error);
    }
  }
);

// ============================================================
// UPDATE (PUT - Full)
// ============================================================
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    ${updateValidators ? updateValidators + ',' : ''}
    validateErrors
  ],
  async (req, res, next) => {
    try {
      const updated = await ${modelName}.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!updated) {
        return ResponseHelper.notFound(res, '${modelName}');
      }

      return ResponseHelper.success(res, updated, '${modelName} updated successfully');
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(e => e.message);
        return ResponseHelper.validationError(res, errors);
      }
      next(error);
    }
  }
);

// ============================================================
// PARTIAL UPDATE (PATCH)
// ============================================================
router.patch(
  '/:id',
  [param('id').isMongoId(), validateErrors],
  async (req, res, next) => {
    try {
      // Don't allow ID changes
      delete req.body._id;
      delete req.body.createdAt;

      const updated = await ${modelName}.findByIdAndUpdate(
        req.params.id,
        { \$set: req.body },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return ResponseHelper.notFound(res, '${modelName}');
      }

      return ResponseHelper.success(res, updated, 'Partial update successful');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// DELETE (Soft Delete)
// ============================================================
router.delete(
  '/:id',
  [param('id').isMongoId(), validateErrors],
  async (req, res, next) => {
    try {
      const deleted = await ${modelName}.softDelete(req.params.id);

      if (!deleted) {
        return ResponseHelper.notFound(res, '${modelName}');
      }

      return ResponseHelper.success(res, deleted, '${modelName} deleted successfully');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// BULK OPERATIONS
// ============================================================

// Bulk Create
router.post(
  '/bulk/create',
  [body('items').isArray({ min: 1 }), validateErrors],
  async (req, res, next) => {
    try {
      const items = await ${modelName}.insertMany(req.body.items);
      return ResponseHelper.success(res, items, \`Created \${items.length} items\`, 201);
    } catch (error) {
      next(error);
    }
  }
);

// Bulk Delete
router.delete(
  '/bulk/delete',
  [body('ids').isArray({ min: 1 }), validateErrors],
  async (req, res, next) => {
    try {
      const result = await ${modelName}.deleteMany({ _id: { $in: req.body.ids } });
      return ResponseHelper.success(res, result, \`Deleted \${result.deletedCount} items\`);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// STATISTICS
// ============================================================
router.get(
  '/stats/summary',
  async (req, res, next) => {
    try {
      const total = await ${modelName}.countDocuments({ isDeleted: false });
      const recent = await ${modelName}.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5);

      return ResponseHelper.success(res, { total, recent }, 'Statistics retrieved');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
`;
}

function generateValidators(fields) {
  const validators = [];
  for (const field of fields) {
    const normalized = field.toLowerCase();
    if (normalized === 'email') {
      validators.push(`body('email').isEmail()`);
    } else if (normalized === 'password') {
      validators.push(`body('password').isLength({ min: 8 })`);
    } else if (normalized.match(/^(price|cost|amount)$/)) {
      validators.push(`body('${field}').optional().isFloat({ min: 0 })`);
    } else if (normalized === 'name' || normalized === 'title') {
      validators.push(`body('${field}').isString().isLength({ min: 2, max: 255 })`);
    }
  }
  return validators.join(',\n    ');
}

function generateUpdateValidators(fields) {
  return generateValidators(fields) || 'validateErrors';
}

export default { generateAdvancedCrudModel, generateAdvancedCrudRoutes };
