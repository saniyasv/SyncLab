import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { unreadOnly } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    if (unreadOnly === 'true') query += ' AND is_read = FALSE';
    query += ' ORDER BY created_at DESC LIMIT 50';

    const [rows] = await pool.query(query, [req.user.id]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', authenticate, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
});

// Internal helper — create notification (not a route)
export async function createNotification(userId, type, title, body) {
  const id = uuid();
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, ?, ?, ?)',
    [id, userId, type, title, body || null]
  );
  return { id, user_id: userId, type, title, body, is_read: false, created_at: new Date() };
}

export default router;
