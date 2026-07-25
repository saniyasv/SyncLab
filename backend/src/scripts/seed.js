import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { pool } from '../db/pool.js';

dotenv.config();

async function seed() {
  try {
    console.log('[seed] Creating demo data…');

    // Demo users
    const users = [
      { name: 'Admin User', email: 'admin@collabhub.com', role: 'admin', password: 'password123' },
      { name: 'Jane Doe', email: 'jane@example.com', role: 'member', password: 'password123' },
      { name: 'John Smith', email: 'john@example.com', role: 'member', password: 'password123' },
    ];

    const userIds = [];
    for (const u of users) {
      const hashed = await bcrypt.hash(u.password, 10);
      const id = uuid();
      userIds.push(id);
      await pool.query(
        'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [id, u.name, u.email, hashed, u.role]
      );
    }

    // Demo rooms
    const rooms = [
      { name: 'Frontend Sprint Review', description: 'Reviewing the latest frontend changes and planning next sprint', language: 'typescript', tags: ['react', 'frontend', 'sprint'], ownerIdx: 1 },
      { name: 'Algorithm Practice', description: 'Solving LeetCode problems together every Wednesday', language: 'python', tags: ['algorithms', 'interview'], ownerIdx: 2 },
      { name: 'API Design Workshop', description: 'Designing RESTful APIs and discussing best practices', language: 'javascript', tags: ['api', 'backend', 'design'], ownerIdx: 1 },
    ];

    for (const r of rooms) {
      const roomId = uuid();
      const ownerId = userIds[r.ownerIdx];
      await pool.query(
        'INSERT INTO rooms (id, name, description, language, tags, owner_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [roomId, r.name, r.description, r.language, JSON.stringify(r.tags), ownerId, true]
      );
      await pool.query(
        'INSERT INTO room_members (id, room_id, user_id, role) VALUES (?, ?, ?, ?)',
        [uuid(), roomId, ownerId, 'owner']
      );
      await pool.query(
        'INSERT INTO room_files (id, room_id, name, language, content) VALUES (?, ?, ?, ?, ?)',
        [uuid(), roomId, `main.${r.language === 'typescript' ? 'ts' : r.language === 'python' ? 'py' : 'js'}`, r.language, '// Start coding here…']
      );
    }

    console.log('[seed] Demo data created:');
    console.log('  Users: admin@collabhub.com / jane@example.com / john@example.com');
    console.log('  Password for all: password123');
  } catch (err) {
    console.error('[seed] Error:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
