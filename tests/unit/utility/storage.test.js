import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: function() {
    return { send: vi.fn() };
  },
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: vi.fn(() => ({
    on: vi.fn(),
    done: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('../../../utility/config.js', () => ({
  S3_CONFIG: {
    bucketName: 'test-bucket',
    publicUrl: 'http://test.com',
  },
}));

import { getPublicUrl } from '../../../utility/storage.js';

describe('storage.js', () => {
  it('should generate correct public URL', () => {
    const url = getPublicUrl('my-file.mp4');
    expect(url).toBe('http://test.com/my-file.mp4');
  });
});