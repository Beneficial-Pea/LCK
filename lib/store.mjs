import {initializeNotices} from './notices.mjs';
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
      CREATE TABLE IF NOT EXISTS accounts (user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT UNIQUE NOT NULL, nickname_key TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')), created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id), expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
      CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')), created_by TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_by TEXT, used_at INTEGER, revoked_at INTEGER);
    `);
    initializeNotices(this);
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
  deleteEmptyRoom(code) {
    const row=this.db.prepare('SELECT data FROM rooms WHERE code=?').get(code);
    if(!row)return {rooms:0,messages:0};
    let room;try{room=JSON.parse(row.data);}catch{return {rooms:0,messages:0};}
    if(!Array.isArray(room?.players)||room.players.length!==0)return {rooms:0,messages:0};
    const messages=Number(this.db.prepare('DELETE FROM messages WHERE room_code=?').run(code).changes);
    const rooms=Number(this.db.prepare('DELETE FROM rooms WHERE code=?').run(code).changes);
    return {rooms,messages};
  }
  purgeEmptyRooms() {
    return this.transaction(()=>{
      const codes=[];
      for(const row of this.db.prepare('SELECT code,data FROM rooms').iterate()){
        try{const room=JSON.parse(row.data);if(Array.isArray(room?.players)&&room.players.length===0)codes.push(row.code);}catch{/* Malformed or incomplete saves are never deletion candidates. */}
      }
      const summary={rooms:0,messages:0};
      for(const code of codes){const removed=this.deleteEmptyRoom(code);summary.rooms+=removed.rooms;summary.messages+=removed.messages;}
      return summary;
    });
  }
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
