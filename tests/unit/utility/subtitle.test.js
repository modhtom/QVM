import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitTextIntoChunks, formatTime, buildFullLine } from '../../../utility/subtitle.js';

describe('subtitle.js utilities', () => {
  describe('splitTextIntoChunks', () => {
    it('should split text into chunks of given length', () => {
      const text = "This is a long sentence that should be split into smaller chunks.";
      const chunks = splitTextIntoChunks(text, 20);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(20);
      });
    });

    it('should return empty array for empty text', () => {
      expect(splitTextIntoChunks("", 10)).toEqual([]);
    });
  });

  describe('formatTime', () => {
    it('should format seconds into ASS time format', () => {
      expect(formatTime(0)).toBe('0:00:00.00');
      expect(formatTime(65.5)).toBe('0:01:05.50');
      expect(formatTime(3661)).toBe('1:01:01.00');
    });

    it('should handle NaN or negative values', () => {
      expect(formatTime(NaN)).toBe('0:00:00.00');
      expect(formatTime(-10)).toBe('0:00:00.00');
    });
  });

  describe('buildFullLine', () => {
    it('should build a basic ASS dialogue line', () => {
      const line = buildFullLine('Arabic', null, null, '&HFFFFFF', 'Arial', 20, 2);
      expect(line).toContain('{\\an2\\c&HFFFFFF\\q1\\bord2\\fnArial}Arabic');
    });

    it('should include translation and transliteration if provided', () => {
      const line = buildFullLine('Arabic', 'Translit', 'Trans', '&HFFFFFF', 'Arial', 20, 2);
      expect(line).toContain('\\N{\\fs100}Translit');
      expect(line).toContain('\\N{\\fs100}Trans');
    });
  });
});