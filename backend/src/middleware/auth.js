import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, name, email, avatar_url, bio, role, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new Error('Not authenticated'));
    if (!roles.includes(req.user.role)) {
      const err = new Error('Insufficient permissions');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

export function requireRoomRole(...allowedRoles) {
  return async (req, _res, next) => {
    const roomId = req.params.roomId || req.params.id;
    if (!roomId || !req.user) return next();

    try {
      const [rows] = await pool.query(
        'SELECT role FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, req.user.id]
      );
      if (rows.length === 0) {
        const err = new Error('You are not a member of this room');
        err.status = 403;
        return next(err);
      }
      req.roomRole = rows[0].role;
      if (allowedRoles.length > 0 && !allowedRoles.includes(rows[0].role)) {
        const err = new Error('Insufficient room permissions');
        err.status = 403;
        return next(err);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
