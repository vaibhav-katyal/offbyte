import express from 'express';
import { body, param } from 'express-validator';
import { validateErrors } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import __MODEL_NAME__ from '../models/__MODEL_NAME__.model.js';

const router = express.Router();

// ========== GET - Fetch All / By Filter ==========
router.get('/', async (req, res, next) => {
  try {
    const data = await __MODEL_NAME__.find().limit(100);
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: '__MODEL_NAME__ not found'
      });
    }

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
});

// ========== GET SINGLE ==========
router.get('/:id', async (req, res, next) => {
  try {
    const data = await __MODEL_NAME__.findById(req.params.id);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '__MODEL_NAME__ not found'
      });
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

// ========== POST - Create New ==========
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const newData = new __MODEL_NAME__(req.body);
    const saved = await newData.save();

    res.status(201).json({
      success: true,
      message: '__MODEL_NAME__ created successfully',
      data: saved
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    next(error);
  }
});

// ========== PUT - Update Entire Document ==========
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const updated = await __MODEL_NAME__.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '__MODEL_NAME__ not found'
      });
    }

    res.status(200).json({
      success: true,
      message: '__MODEL_NAME__ updated successfully',
      data: updated
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    next(error);
  }
});

// ========== DELETE ==========
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await __MODEL_NAME__.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '__MODEL_NAME__ not found'
      });
    }

    res.status(200).json({
      success: true,
      message: '__MODEL_NAME__ deleted successfully',
      data: deleted
    });
  } catch (error) {
    next(error);
  }
});

export default router;
