import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

const { verify } = jwt;

export function setupSocket(io) {
  // Socket auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('room:join', async ({ roomId }) => {
      if (currentRoom) socket.leave(currentRoom);
      currentRoom = roomId;
      socket.join(roomId);

      const [rows] = await pool.query(
        `SELECT u.id FROM room_members rm
         JOIN users u ON rm.user_id = u.id
         WHERE rm.room_id = ?`,
        [roomId]
      );
      const onlineInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((sid) => {
        const s = io.sockets.sockets.get(sid);
        return s?.userId;
      }).filter(Boolean);

      socket.to(roomId).emit('room:user_joined', { userId: socket.userId });
      io.to(socket.id).emit('room:state', { onlineUsers: onlineInRoom });
    });

    socket.on('room:leave', ({ roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit('room:user_left', { userId: socket.userId });
      currentRoom = null;
    });

    // ── Chat ──
    socket.on('chat:message', async ({ roomId, content }) => {
      const [userRows] = await pool.query('SELECT name, avatar_url FROM users WHERE id = ?', [socket.userId]);
      if (userRows.length === 0) return;
      const user = userRows[0];

      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      await pool.query(
        'INSERT INTO messages (id, room_id, user_id, content) VALUES (?, ?, ?, ?)',
        [id, roomId, socket.userId, content]
      );

      const msg = {
        id,
        room_id: roomId,
        user_id: socket.userId,
        user_name: user.name,
        user_avatar: user.avatar_url,
        content,
        created_at: new Date().toISOString(),
      };

      io.to(roomId).emit('chat:message', msg);
    });

    // ── Code editor ──
    let saveTimeout = null;
    socket.on('code:update', ({ roomId, content }) => {
      socket.to(roomId).emit('code:update', { content });

      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await pool.query('UPDATE room_files SET content = ? WHERE room_id = ?', [content, roomId]);
      }, 1000);
    });

    // ── Whiteboard ──
    socket.on('whiteboard:shape:add', (shape) => {
      socket.to(shape.room_id).emit('whiteboard:shape:add', shape);
      pool.query(
        'INSERT INTO whiteboard_shapes (id, room_id, type, props, created_by) VALUES (?, ?, ?, ?, ?)',
        [shape.id, shape.room_id, shape.type, JSON.stringify(shape.props), socket.userId]
      ).catch(() => {});
    });

    socket.on('whiteboard:shape:remove', ({ roomId, id }) => {
      socket.to(roomId).emit('whiteboard:shape:remove', { id });
      pool.query('DELETE FROM whiteboard_shapes WHERE id = ?', [id]).catch(() => {});
    });

    socket.on('whiteboard:clear', ({ roomId }) => {
      socket.to(roomId).emit('whiteboard:clear');
      pool.query('DELETE FROM whiteboard_shapes WHERE room_id = ?', [roomId]).catch(() => {});
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      if (currentRoom) {
        socket.to(currentRoom).emit('room:user_left', { userId: socket.userId });
      }
    });
  });
}
