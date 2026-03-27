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

import { initDB, createUser, findUserByUsername } from '../../../utility/db.js';

describe('db.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize database with tables', async () => {
    mockExecuteMultiple.mockResolvedValue({});
    mockExecute.mockResolvedValue({});
    await initDB();
    expect(mockExecuteMultiple).toHaveBeenCalled();
  });

  it('should create a user and return the object', async () => {
    mockExecute.mockResolvedValue({ lastInsertRowid: 123 });
    const result = await createUser('testuser', 'test@example.com', 'hashedpassword');
    expect(result).toEqual({ id: 123, username: 'testuser', email: 'test@example.com' });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO users'),
      args: ['testuser', 'test@example.com', 'hashedpassword'],
    }));
  });

  it('should find a user by username', async () => {
    const mockUser = { id: 1, username: 'existinguser' };
    mockExecute.mockResolvedValue({ rows: [mockUser] });
    const result = await findUserByUsername('existinguser');
    expect(result).toEqual(mockUser);
  });

  it('should return null if user is not found', async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const result = await findUserByUsername('nonexistent');
    expect(result).toBeNull();
  });
});