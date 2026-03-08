/**
 * Generic Resource Routes Template - CRUD only
 */

export const ROUTES_GENERIC_TEMPLATE = `import express from 'express';
import <%= capitalize(resource.singular) %> from '../models/<%= capitalize(resource.singular) %>.model.js';

const router = express.Router();

// GET all <%= resource.plural %>
router.get('/', async (req, res) => {
  try {
    const { skip = 0, limit = 100 } = req.query;
    const data = await <%= capitalize(resource.singular) %>.find({ isDeleted: false }).skip(parseInt(skip)).limit(parseInt(limit));
    const total = await <%= capitalize(resource.singular) %>.countDocuments({ isDeleted: false });
    res.json({ success: true, data, total, skip: parseInt(skip), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single <%= resource.singular %>
router.get('/:id', async (req, res) => {
  try {
    const data = await <%= capitalize(resource.singular) %>.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create <%= resource.singular %>
router.post('/', async (req, res) => {
  try {
    const data = new <%= capitalize(resource.singular) %>(req.body);
    await data.save();
    res.status(201).json({ success: true, data, message: 'Created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update <%= resource.singular %>
router.put('/:id', async (req, res) => {
  try {
    const data = await <%= capitalize(resource.singular) %>.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data, message: 'Updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE <%= resource.singular %>
router.delete('/:id', async (req, res) => {
  try {
    await <%= capitalize(resource.singular) %>.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
`;
