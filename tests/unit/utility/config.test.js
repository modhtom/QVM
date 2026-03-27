import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

describe('config.js', async () => {
  const { PATHS, S3_CONFIG, VIDEO_DEFAULTS, ALLOWED_FONT_CHARS } = await import('../../../utility/config.js');

  it('should have basic paths defined', () => {
    expect(PATHS).toBeDefined();
    expect(PATHS.DATA).toBeDefined();
    expect(typeof PATHS.DATA).toBe('string');
  });

  it('should have S3 config properties', () => {
    expect(S3_CONFIG).toBeDefined();
    expect(S3_CONFIG.bucketName).toBeDefined();
    expect(S3_CONFIG.credentials).toBeDefined();
  });

  it('should have video defaults with correct types', () => {
    expect(VIDEO_DEFAULTS).toBeDefined();
    expect(typeof VIDEO_DEFAULTS.API_TIMEOUT).toBe('number');
    expect(typeof VIDEO_DEFAULTS.DEFAULT_COLOR).toBe('string');
  });

  it('should have a functional regex for font names', () => {
    expect(ALLOWED_FONT_CHARS).toBeDefined();
    expect(ALLOWED_FONT_CHARS.test('Amiri')).toBe(true);
    expect(ALLOWED_FONT_CHARS.test('Noto-Sans-123')).toBe(true);
  });
});