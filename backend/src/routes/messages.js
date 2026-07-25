import { Router } from 'express';
import { body } from 'express-validator';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticate, requireRoomRole } from '../middleware/auth.js';
import { validate } from '../middleware/error.js';

const router = Router({ mergeParams: true });

// GET /api/rooms/:roomId/messages
router.get('/', authenticate, requireRoomRole(), async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { limit = '50', before } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    let query = `
      SELECT m.id, m.room_id, m.user_id, u.name as user_name, u.avatar_url as user_avatar,
             m.content, m.created_at
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?`;
    const params = [roomId];

    if (before) {
      query += ' AND m.created_at < ?';
      params.push(before);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limitNum);

    const [rows] = await pool.query(query, params);
    res.json(rows.reverse());
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms/:roomId/messages
router.post(
  '/',
  authenticate,
  requireRoomRole(),
  [body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1–2000 characters')],
  validate,
  async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { content } = req.body;
      const id = uuid();

      await pool.query(
        'INSERT INTO messages (id, room_id, user_id, content) VALUES (?, ?, ?, ?)',
        [id, roomId, req.user.id, content]
      );

      const [rows] = await pool.query(
        `SELECT m.id, m.room_id, m.user_id, u.name as user_name, u.avatar_url as user_avatar,
                m.content, m.created_at
         FROM messages m JOIN users u ON m.user_id = u.id
         WHERE m.id = ?`,
        [id]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
