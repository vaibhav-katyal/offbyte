/**
 * Express Routes Template
 */

export const ROUTES_TEMPLATE = `import express from 'express';
import <%= capitalize(resource.singular) %> from '../models/<%= capitalize(resource.singular) %>.model.js';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '7d';

// POST signup (for users resource only)
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    const existing = await <%= capitalize(resource.singular) %>.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });
    const hashedPassword = await bcryptjs.hash(password, 10);
    const data = new <%= capitalize(resource.singular) %>({ username, email, password: hashedPassword, firstName, lastName, role: 'student' });
    await data.save();
    const token = jwt.sign({ id: data._id, email: data.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.status(201).json({ success: true, message: 'User created', data: { id: data._id, email: data.email, firstName: data.firstName, lastName: data.lastName }, token });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST login (for users resource only)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await <%= capitalize(resource.singular) %>.findOne({ email });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const isValid = await bcryptjs.compare(password, user.password);
    if (!isValid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.json({ success: true, message: 'Login successful', data: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName }, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all <%= resource.plural %>
router.get('/', async (req, res) => {
  try {
    const { skip = 0, limit = 100 } = req.query;
    const data = await <%= capitalize(resource.singular) %>.find({ isDeleted: false }).skip(parseInt(skip)).limit(parseInt(limit)).populate('user').populate('event').populate('club').populate('organizer').populate('admin').populate('members');
    const total = await <%= capitalize(resource.singular) %>.countDocuments({ isDeleted: false });
    res.json({ success: true, data, total, skip: parseInt(skip), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single <%= resource.singular %>
router.get('/:id', async (req, res) => {
  try {
    const data = await <%= capitalize(resource.singular) %>.findById(req.params.id).populate('user').populate('event').populate('club').populate('organizer').populate('admin').populate('members');
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
    await data.populate('user').populate('event').populate('club').populate('organizer').populate('admin').populate('members');
    res.status(201).json({ success: true, data, message: 'Created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update <%= resource.singular %>
router.put('/:id', async (req, res) => {
  try {
    const data = await <%= capitalize(resource.singular) %>.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('user').populate('event').populate('club').populate('organizer').populate('admin').populate('members');
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
