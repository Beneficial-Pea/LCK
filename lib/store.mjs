import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  constructor(filename) {
    mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT NOT NULL, channel TEXT NOT NULL, sender_id TEXT NOT NULL, recipient TEXT, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_room ON messages(room_code, id);
    `);
  }
  userByToken(hash) {
    const row = this.db.prepare('SELECT data FROM users WHERE token_hash=?').get(hash);
    return row ? JSON.parse(row.data) : null;
  }
  user(id) {
    const row = this.db.prepare('SELECT data FROM users WHERE id=?').get(id);
    return row ? JSON.parse(row.data) : null;
  }
  createUser(user, hash) { this.db.prepare('INSERT INTO users VALUES (?,?,?)').run(user.id, hash, JSON.stringify(user)); }
  saveUser(user) { this.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(user), user.id); }
  room(code) {
    const row = this.db.prepare('SELECT data FROM rooms WHERE code=?').get(code);
    return row ? JSON.parse(row.data) : null;
  }
  roomsFor(userId) {
    return this.db.prepare('SELECT data FROM rooms').all().map(row => JSON.parse(row.data))
      .filter(room => room.players.some(p => p.userId === userId));
  }
  saveRoom(room) { this.db.prepare('INSERT INTO rooms VALUES (?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data').run(room.code, JSON.stringify(room)); }
  addMessage(code, msg) {
    const id = this.db.prepare('INSERT INTO messages(room_code,channel,sender_id,recipient,data) VALUES (?,?,?,?,?)')
      .run(code, msg.channel, msg.senderId, msg.to || null, JSON.stringify(msg)).lastInsertRowid;
    return { ...msg, id: Number(id) };
  }
  messages(code, userId) {
    return this.db.prepare(`SELECT id,data FROM messages WHERE room_code=? AND
      (channel!='dm' OR sender_id=? OR recipient=?) ORDER BY id DESC LIMIT 200`)
      .all(code, userId, userId).reverse().map(row => ({ ...JSON.parse(row.data), id: row.id }));
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
