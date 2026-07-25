import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticate, requireRoomRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

// GET /api/rooms/:roomId/whiteboard
router.get('/', authenticate, requireRoomRole(), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, room_id, type, props, created_by, updated_at FROM whiteboard_shapes WHERE room_id = ?',
      [req.params.roomId]
    );
    const shapes = rows.map((r) => ({
      ...r,
      props: typeof r.props === 'string' ? JSON.parse(r.props) : r.props,
    }));
    res.json(shapes);
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms/:roomId/whiteboard
router.post('/', authenticate, requireRoomRole('owner', 'editor'), async (req, res, next) => {
  try {
    const { type, props } = req.body;
    const id = uuid();

    await pool.query(
      'INSERT INTO whiteboard_shapes (id, room_id, type, props, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.roomId, type, JSON.stringify(props), req.user.id]
    );

    const [rows] = await pool.query('SELECT * FROM whiteboard_shapes WHERE id = ?', [id]);
    const shape = {
      ...rows[0],
      props: typeof rows[0].props === 'string' ? JSON.parse(rows[0].props) : rows[0].props,
    };
    res.status(201).json(shape);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rooms/:roomId/whiteboard/:shapeId
router.delete('/:shapeId', authenticate, requireRoomRole('owner', 'editor'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM whiteboard_shapes WHERE id = ?', [req.params.shapeId]);
    res.json({ message: 'Shape deleted' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rooms/:roomId/whiteboard  (clear all)
router.delete('/', authenticate, requireRoomRole('owner', 'editor'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM whiteboard_shapes WHERE room_id = ?', [req.params.roomId]);
    res.json({ message: 'Whiteboard cleared' });
  } catch (err) {
    next(err);
  }
});

export default router;
