import { Router } from 'express';
import { body } from 'express-validator';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoomRole } from '../middleware/auth.js';
import { validate, notFound, errorHandler } from '../middleware/error.js';

const router = Router();

function formatRoom(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    language: row.language,
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    member_count: row.member_count,
    is_public: !!row.is_public,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/rooms  (list + search + pagination)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { q, lang, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params = [];

    if (q) {
      where += ' AND (r.name LIKE ? OR r.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (lang && lang !== 'all') {
      where += ' AND r.language = ?';
      params.push(lang);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM rooms r ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT r.*, u.name as owner_name,
        (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
       FROM rooms r
       JOIN users u ON r.owner_id = u.id
       ${where}
       ORDER BY r.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      rooms: rows.map(formatRoom),
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:roomId
router.get('/:roomId', authenticate, requireRoomRole(), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.name as owner_name,
        (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
       FROM rooms r
       JOIN users u ON r.owner_id = u.id
       WHERE r.id = ?`,
      [req.params.roomId]
    );
    if (rows.length === 0) return notFound(req, res);
    res.json(formatRoom(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms
router.post(
  '/',
  authenticate,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Room name must be 2–80 characters'),
    body('description').optional().isLength({ max: 300 }).withMessage('Description must be under 300 characters'),
    body('language').trim().notEmpty().withMessage('Language is required'),
    body('tags').optional().isArray({ max: 5 }).withMessage('Maximum 5 tags'),
    body('is_public').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description = '', language, tags = [], is_public = true } = req.body;
      const id = uuid();

      await pool.query(
        'INSERT INTO rooms (id, name, description, language, tags, owner_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, name, description, language, JSON.stringify(tags), req.user.id, is_public]
      );

      await pool.query(
        'INSERT INTO room_members (id, room_id, user_id, role) VALUES (?, ?, ?, ?)',
        [uuid(), id, req.user.id, 'owner']
      );

      await pool.query(
        'INSERT INTO room_files (id, room_id, name, language, content) VALUES (?, ?, ?, ?, ?)',
        [uuid(), id, `main.${language === 'javascript' ? 'js' : language}`, language, '']
      );

      const [rows] = await pool.query(
        `SELECT r.*, u.name as owner_name,
          (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
         FROM rooms r JOIN users u ON r.owner_id = u.id
         WHERE r.id = ?`,
        [id]
      );

      res.status(201).json(formatRoom(rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/rooms/:roomId  (owner only)
router.put(
  '/:roomId',
  authenticate,
  requireRoomRole('owner'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 80 }),
    body('description').optional().isLength({ max: 300 }),
    body('language').optional().trim().notEmpty(),
    body('tags').optional().isArray({ max: 5 }),
    body('is_public').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, language, tags, is_public } = req.body;
      const updates = [];
      const values = [];

      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }
      if (language !== undefined) { updates.push('language = ?'); values.push(language); }
      if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
      if (is_public !== undefined) { updates.push('is_public = ?'); values.push(is_public); }

      if (updates.length === 0) {
        const [rows] = await pool.query(
          `SELECT r.*, u.name as owner_name,
            (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
           FROM rooms r JOIN users u ON r.owner_id = u.id WHERE r.id = ?`,
          [req.params.roomId]
        );
        return res.json(formatRoom(rows[0]));
      }

      values.push(req.params.roomId);
      await pool.query(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, values);

      const [rows] = await pool.query(
        `SELECT r.*, u.name as owner_name,
          (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
         FROM rooms r JOIN users u ON r.owner_id = u.id WHERE r.id = ?`,
        [req.params.roomId]
      );
      res.json(formatRoom(rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/rooms/:roomId  (owner only)
router.delete('/:roomId', authenticate, requireRoomRole('owner'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM rooms WHERE id = ?', [req.params.roomId]);
    res.json({ message: 'Room deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms/:roomId/join
router.post('/:roomId/join', authenticate, async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const [roomRows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (roomRows.length === 0) return res.status(404).json({ message: 'Room not found' });

    const [existing] = await pool.query(
      'SELECT id FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.user.id]
    );
    if (existing.length > 0) {
      return res.json({ message: 'Already a member' });
    }

    await pool.query(
      'INSERT INTO room_members (id, room_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuid(), roomId, req.user.id, 'editor']
    );

    res.json({ message: 'Joined room' });
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms/:roomId/leave
router.post('/:roomId/leave', authenticate, async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const [memberRow] = await pool.query(
      'SELECT role FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.user.id]
    );
    if (memberRow.length === 0) {
      return res.status(400).json({ message: 'You are not a member of this room' });
    }
    if (memberRow[0].role === 'owner') {
      return res.status(400).json({ message: 'Owner cannot leave. Transfer or delete the room instead.' });
    }

    await pool.query('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, req.user.id]);
    res.json({ message: 'Left room' });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:roomId/members
router.get('/:roomId/members', authenticate, requireRoomRole(), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.room_id, m.user_id, u.name as user_name, u.avatar_url as user_avatar,
              m.role, m.joined_at
       FROM room_members m
       JOIN users u ON m.user_id = u.id
       WHERE m.room_id = ?
       ORDER BY m.joined_at ASC`,
      [req.params.roomId]
    );
    res.json(rows.map((r) => ({ ...r, online: false })));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/rooms/:roomId/members/:userId  (owner only — change role)
router.patch(
  '/:roomId/members/:userId',
  authenticate,
  requireRoomRole('owner'),
  [
    body('role').isIn(['editor', 'viewer']).withMessage('Role must be editor or viewer'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { roomId, userId } = req.params;
      const { role } = req.body;

      await pool.query(
        'UPDATE room_members SET role = ? WHERE room_id = ? AND user_id = ?',
        [role, roomId, userId]
      );
      res.json({ message: 'Member role updated' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/rooms/:roomId/members/:userId  (owner only — kick)
router.delete(
  '/:roomId/members/:userId',
  authenticate,
  requireRoomRole('owner'),
  async (req, res, next) => {
    try {
      const { roomId, userId } = req.params;

      const [member] = await pool.query(
        'SELECT role FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
      );
      if (member.length === 0) return res.status(404).json({ message: 'Member not found' });
      if (member[0].role === 'owner') {
        return res.status(400).json({ message: 'Cannot remove the room owner' });
      }

      await pool.query('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
      res.json({ message: 'Member removed' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
