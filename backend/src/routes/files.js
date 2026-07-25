import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticate, requireRoomRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

// GET /api/rooms/:roomId/files
router.get('/', authenticate, requireRoomRole(), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, room_id, name, language, content, created_at, updated_at FROM room_files WHERE room_id = ? ORDER BY created_at ASC',
      [req.params.roomId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/rooms/:roomId/files/:fileId  (save code content)
router.put('/:fileId', authenticate, requireRoomRole('owner', 'editor'), async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { content } = req.body;

    await pool.query('UPDATE room_files SET content = ? WHERE id = ?', [content, fileId]);
    const [rows] = await pool.query(
      'SELECT id, room_id, name, language, content, created_at, updated_at FROM room_files WHERE id = ?',
      [fileId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms/:roomId/files  (create new file)
router.post('/', authenticate, requireRoomRole('owner', 'editor'), async (req, res, next) => {
  try {
    const { name, language, content = '' } = req.body;
    const id = uuid();

    await pool.query(
      'INSERT INTO room_files (id, room_id, name, language, content) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.roomId, name, language, content]
    );

    const [rows] = await pool.query('SELECT * FROM room_files WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rooms/:roomId/files/:fileId
router.delete('/:fileId', authenticate, requireRoomRole('owner'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM room_files WHERE id = ?', [req.params.fileId]);
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
