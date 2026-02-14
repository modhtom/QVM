import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../Data/db');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'qvm.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    s3Key TEXT NOT NULL,
    filename TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_userId ON videos(userId);
CREATE INDEX IF NOT EXISTS idx_videos_s3Key ON videos(s3Key);
`);

export function createUser(username, email, passwordHash) {
    const stmt = db.prepare(
        'INSERT INTO users (username, email, passwordHash) VALUES (?, ?, ?)'
    );
    const result = stmt.run(username, email, passwordHash);
    return { id: result.lastInsertRowid, username, email };
}

export function findUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function findUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function findUserById(id) {
    return db.prepare('SELECT id, username, email, createdAt FROM users WHERE id = ?').get(id);
}

export function getAllVideosInfo() {
    return db.prepare('SELECT * FROM videos');
}
export function getAllUsersInfo() {
    return db.prepare('SELECT * FROM users');
}

export function addVideo(userId, s3Key, filename) {
    const stmt = db.prepare(
        'INSERT INTO videos (userId, s3Key, filename) VALUES (?, ?, ?)'
    );
    const result = stmt.run(userId, s3Key, filename);
    return { id: result.lastInsertRowid, userId, s3Key, filename };
}

export function getUserVideos(userId) {
    return db.prepare(
        'SELECT * FROM videos WHERE userId = ? ORDER BY createdAt DESC'
    ).all(userId);
}

export function findVideoByKey(s3Key) {
    return db.prepare('SELECT * FROM videos WHERE s3Key = ?').get(s3Key);
}

export function deleteUserVideo(userId, s3Key) {
    const result = db.prepare(
        'DELETE FROM videos WHERE userId = ? AND s3Key = ?'
    ).run(userId, s3Key);
    return result.changes > 0;
}

export default db;