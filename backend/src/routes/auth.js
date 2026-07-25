import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/error.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar_url: row.avatar_url || null,
    bio: row.bio || null,
    role: row.role,
    created_at: row.created_at,
  };
}

// POST /api/auth/signup
router.post(
  '/signup',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
    body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ message: 'An account with this email already exists' });
      }

      const hashed = await bcrypt.hash(password, 10);
      const id = uuid();

      await pool.query(
        'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
        [id, name, email, hashed]
      );

      const [rows] = await pool.query(
        'SELECT id, name, email, avatar_url, bio, role, created_at FROM users WHERE id = ?',
        [id]
      );
      const user = sanitizeUser(rows[0]);
      const token = signToken(id);

      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (rows.length === 0) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const userRow = rows[0];
      const match = await bcrypt.compare(password, userRow.password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = sanitizeUser(userRow);
      const token = signToken(userRow.id);

      res.json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json(sanitizeUser(req.user));
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/me
router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
    body('bio').optional().isLength({ max: 200 }).withMessage('Bio must be under 200 characters'),
    body('avatar_url').optional().isURL().withMessage('Avatar must be a valid URL'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, bio, avatar_url } = req.body;
      const updates = [];
      const values = [];

      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
      if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url); }

      if (updates.length === 0) {
        return res.json(sanitizeUser(req.user));
      }

      values.push(req.user.id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

      const [rows] = await pool.query(
        'SELECT id, name, email, avatar_url, bio, role, created_at FROM users WHERE id = ?',
        [req.user.id]
      );
      res.json(sanitizeUser(rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
