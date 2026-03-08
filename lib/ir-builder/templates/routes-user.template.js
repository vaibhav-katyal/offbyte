/**
 * User Routes Template - With Auth
 */

export const ROUTES_USER_TEMPLATE = `import express from 'express';
import User from '../models/User.model.js';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '7d';

// POST signup
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });
    const hashedPassword = await bcryptjs.hash(password, 10);
    const userRole = role || 'student';
    const data = new User({ username, email, password: hashedPassword, firstName, lastName, role: userRole });
    await data.save();
    const token = jwt.sign({ id: data._id, email: data.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.status(201).json({ success: true, message: 'User created', data: { id: data._id, email: data.email, firstName: data.firstName, lastName: data.lastName, role: userRole }, token });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const isValid = await bcryptjs.compare(password, user.password);
    if (!isValid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.json({ success: true, message: 'Login successful', data: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all users
router.get('/', async (req, res) => {
  try {
    const { skip = 0, limit = 100 } = req.query;
    const data = await User.find({ isDeleted: false }).skip(parseInt(skip)).limit(parseInt(limit));
    const total = await User.countDocuments({ isDeleted: false });
    res.json({ success: true, data, total, skip: parseInt(skip), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single user
router.get('/:id', async (req, res) => {
  try {
    const data = await User.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create user
router.post('/', async (req, res) => {
  try {
    const data = new User(req.body);
    if (data.password) {
      data.password = await bcryptjs.hash(data.password, 10);
    }
    await data.save();
    res.status(201).json({ success: true, data, message: 'Created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update user
router.put('/:id', async (req, res) => {
  try {
    const data = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data, message: 'Updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE user
router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
`;
