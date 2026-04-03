import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecute, mockExecuteMultiple } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockExecuteMultiple: vi.fn(),
}));

vi.mock('@libsql/client', () => ({
  createClient: vi.fn(() => ({
    execute: mockExecute,
    executeMultiple: mockExecuteMultiple,
  })),
}));

import * as db from '../../../utility/db.js';

describe('db.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize the database', async () => {
    mockExecuteMultiple.mockResolvedValue({});
    mockExecute.mockResolvedValue({});
    await db.initDB();
    expect(mockExecuteMultiple).toHaveBeenCalled();
  });

  it('should create a user', async () => {
    mockExecute.mockResolvedValue({ lastInsertRowid: 1n });
    const user = await db.createUser('testuser', 'test@example.com', 'hash');
    expect(user.id).toBe(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO users'),
      args: ['testuser', 'test@example.com', 'hash']
    }));
  });

  it('should find user by username', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockExecute.mockResolvedValue({ rows: [mockUser] });
    const user = await db.findUserByUsername('testuser');
    expect(user).toEqual(mockUser);
  });

  it('should find user by email', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    mockExecute.mockResolvedValue({ rows: [mockUser] });
    const user = await db.findUserByEmail('test@example.com');
    expect(user).toEqual(mockUser);
  });

  it('should find user by id', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockExecute.mockResolvedValue({ rows: [mockUser] });
    const user = await db.findUserById(1);
    expect(user).toEqual(mockUser);
  });

  it('should create an auth token', async () => {
    mockExecute.mockResolvedValue({ lastInsertRowid: 10n });
    const expiresAt = new Date();
    const token = await db.createAuthToken(1, 'token123', 'verify', expiresAt);
    expect(token.id).toBe(10);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
        args: [1, 'token123', 'verify', expiresAt.toISOString()]
    }));
  });

  it('should find an auth token', async () => {
    const mockToken = { token: 'token123', type: 'verify' };
    mockExecute.mockResolvedValue({ rows: [mockToken] });
    const token = await db.findAuthToken('token123', 'verify');
    expect(token).toEqual(mockToken);
  });

  it('should delete auth tokens for user', async () => {
    await db.deleteAuthTokensForUser(1, 'verify');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('DELETE FROM auth_tokens'),
        args: [1, 'verify']
    }));
  });

  it('should verify user email', async () => {
    await db.verifyUserEmail(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('UPDATE users SET isVerified = 1'),
        args: [1]
    }));
  });

  it('should update user password', async () => {
    await db.updateUserPassword(1, 'newhash');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('UPDATE users SET passwordHash = ?'),
        args: ['newhash', 1]
    }));
  });

  it('should add a video', async () => {
    mockExecute.mockResolvedValue({ lastInsertRowid: 100n });
    const video = await db.addVideo(1, 'key123', 'file.mp4');
    expect(video.id).toBe(100);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
        args: [1, 'key123', 'file.mp4']
    }));
  });

  it('should get user videos', async () => {
    const mockVideos = [{ id: 1, s3Key: 'k1' }, { id: 2, s3Key: 'k2' }];
    mockExecute.mockResolvedValue({ rows: mockVideos });
    const videos = await db.getUserVideos(1);
    expect(videos).toEqual(mockVideos);
  });

  it('should find video by key', async () => {
    const mockVideo = { id: 1, s3Key: 'key123' };
    mockExecute.mockResolvedValue({ rows: [mockVideo] });
    const video = await db.findVideoByKey('key123');
    expect(video).toEqual(mockVideo);
  });

  it('should delete user video', async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 });
    const success = await db.deleteUserVideo(1, 'key123');
    expect(success).toBe(true);
  });

  it('should delete user and related data', async () => {
    await db.deleteUser(1);
    expect(mockExecute).toHaveBeenCalledTimes(3);
    expect(mockExecute).toHaveBeenNthCalledWith(3, expect.objectContaining({
        sql: expect.stringContaining('DELETE FROM users WHERE id = ?'),
        args: [1]
    }));
  });
});