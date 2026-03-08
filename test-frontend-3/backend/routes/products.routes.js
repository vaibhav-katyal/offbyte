import express from 'express';
import { query, body, param } from 'express-validator';
import { validateErrors } from '../middleware/validation.js';
import { PaginationHelper } from '../utils/pagination.js';
import { ResponseHelper } from '../utils/helper.js';
import Product from '../models/Product.js';

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
        query = PaginationHelper.buildSearchQuery(req.query.search, ['']);
      }

      // Apply additional filters
      const filters = PaginationHelper.buildFilterQuery(req, []);
      query = { ...query, ...filters };

      // Exclude deleted items by default
      query.isDeleted = false;

      // Execute paginated query
      const result = await PaginationHelper.paginate(Product, query, { page, limit, skip, sort });

      return ResponseHelper.paginated(res, result.data, result.pagination, 'products loaded successfully');
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
      const item = await Product.findOne({ _id: req.params.id, isDeleted: false });

      if (!item) {
        return ResponseHelper.notFound(res, 'Product');
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
  [validateErrors],
  async (req, res, next) => {
    try {
      const newItem = new Product(req.body);
      const saved = await newItem.save();

      return ResponseHelper.success(res, saved, 'Product created successfully', 201);
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
    validateErrors,
    validateErrors
  ],
  async (req, res, next) => {
    try {
      const updated = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!updated) {
        return ResponseHelper.notFound(res, 'Product');
      }

      return ResponseHelper.success(res, updated, 'Product updated successfully');
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

      const updated = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return ResponseHelper.notFound(res, 'Product');
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
      const deleted = await Product.softDelete(req.params.id);

      if (!deleted) {
        return ResponseHelper.notFound(res, 'Product');
      }

      return ResponseHelper.success(res, deleted, 'Product deleted successfully');
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
      const items = await Product.insertMany(req.body.items);
      return ResponseHelper.success(res, items, `Created ${items.length} items`, 201);
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
      const result = await Product.deleteMany({ _id: { $in: req.body.ids } });
      return ResponseHelper.success(res, result, `Deleted ${result.deletedCount} items`);
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
      const total = await Product.countDocuments({ isDeleted: false });
      const recent = await Product.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5);

      return ResponseHelper.success(res, { total, recent }, 'Statistics retrieved');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
