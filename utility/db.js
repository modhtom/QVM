import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:Data/db/qvm.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDB() {
    await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            isVerified INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS auth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
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
        CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
    `);

    try {
        await db.execute('ALTER TABLE users ADD COLUMN isVerified INTEGER DEFAULT 0;');
        console.log('[DB] Added isVerified column to users table.');
    } catch (e) {
        // Ignore if column already exists
    }

    console.log('[DB] Turso database initialized.');
}

export async function createUser(username, email, passwordHash) {
    const result = await db.execute({
        sql: 'INSERT INTO users (username, email, passwordHash) VALUES (?, ?, ?)',
        args: [username, email, passwordHash],
    });
    return { id: Number(result.lastInsertRowid), username, email };
}

export async function findUserByUsername(username) {
    const result = await db.execute({
        sql: 'SELECT * FROM users WHERE username = ?',
        args: [username],
    });
    return result.rows[0] || null;
}

export async function findUserByEmail(email) {
    const result = await db.execute({
        sql: 'SELECT * FROM users WHERE email = ?',
        args: [email],
    });
    return result.rows[0] || null;
}

export async function findUserById(id) {
    const result = await db.execute({
        sql: 'SELECT id, username, email, isVerified, createdAt FROM users WHERE id = ?',
        args: [id],
    });
    return result.rows[0] || null;
}

export async function createAuthToken(userId, token, type, expiresAtDate) {
    const result = await db.execute({
        sql: 'INSERT INTO auth_tokens (userId, token, type, expiresAt) VALUES (?, ?, ?, ?)',
        args: [userId, token, type, expiresAtDate.toISOString()],
    });
    return { id: Number(result.lastInsertRowid), userId, token, type };
}

export async function findAuthToken(token, type) {
    const result = await db.execute({
        sql: 'SELECT * FROM auth_tokens WHERE token = ? AND type = ? AND expiresAt > datetime("now")',
        args: [token, type],
    });
    return result.rows[0] || null;
}

export async function deleteAuthTokensForUser(userId, type) {
    await db.execute({
        sql: 'DELETE FROM auth_tokens WHERE userId = ? AND type = ?',
        args: [userId, type],
    });
}

export async function verifyUserEmail(userId) {
    await db.execute({
        sql: 'UPDATE users SET isVerified = 1 WHERE id = ?',
        args: [userId],
    });
}

export async function updateUserPassword(userId, newPasswordHash) {
    await db.execute({
        sql: 'UPDATE users SET passwordHash = ? WHERE id = ?',
        args: [newPasswordHash, userId],
    });
}

export async function addVideo(userId, s3Key, filename) {
    const result = await db.execute({
        sql: 'INSERT INTO videos (userId, s3Key, filename) VALUES (?, ?, ?)',
        args: [userId, s3Key, filename],
    });
    return { id: Number(result.lastInsertRowid), userId, s3Key, filename };
}

export async function getUserVideos(userId) {
    const result = await db.execute({
        sql: 'SELECT * FROM videos WHERE userId = ? ORDER BY createdAt DESC',
        args: [userId],
    });
    return result.rows;
}

export async function findVideoByKey(s3Key) {
    const result = await db.execute({
        sql: 'SELECT * FROM videos WHERE s3Key = ?',
        args: [s3Key],
    });
    return result.rows[0] || null;
}

export async function deleteUserVideo(userId, s3Key) {
    const result = await db.execute({
        sql: 'DELETE FROM videos WHERE userId = ? AND s3Key = ?',
        args: [userId, s3Key],
    });
    return result.rowsAffected > 0;
}

export async function deleteUser(userId) {
    await db.execute({ sql: 'DELETE FROM auth_tokens WHERE userId = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM videos WHERE userId = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
}

export default db;