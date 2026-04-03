import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import * as subtitle from '../../../utility/subtitle.js';

describe('subtitle.js', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('splitTextIntoNChunks', () => {
    it('should split text into N equal-ish chunks', () => {
      const text = "one two three four five six";
      const chunks = subtitle.splitTextIntoNChunks(text, 3);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toBe("one two");
    });

    it('should return empty array for null text', () => {
      expect(subtitle.splitTextIntoNChunks(null, 3)).toEqual([]);
    });

    it('should pad with empty strings if text has fewer words than N', () => {
      const chunks = subtitle.splitTextIntoNChunks("one", 3);
      expect(chunks).toEqual(["one", "", ""]);
    });
  });

  describe('splitTextIntoChunks', () => {
    it('should split text by max length', () => {
      const text = "a short string";
      const chunks = subtitle.splitTextIntoChunks(text, 5);
      expect(chunks).toEqual(["a", "short", "string"]);
    });
  });

  describe('formatTime', () => {
    it('should format seconds to ASS time format', () => {
      expect(subtitle.formatTime(0.5)).toBe('0:00:00.50');
      expect(subtitle.formatTime(3661.123)).toBe('1:01:01.12');
      expect(subtitle.formatTime(-1)).toBe('0:00:00.00');
    });
  });

  describe('buildFullLine', () => {
    it('should assemble a styled ASS line', () => {
      const line = subtitle.buildFullLine('Arabic', 'Translit', 'Trans', 'Color', 'Font', 12, 2);
      expect(line).toContain('Arabic');
      expect(line).toContain('Translit');
      expect(line).toContain('Trans');
      expect(line).toContain('Font');
    });
  });

  describe('generateSubtitles', () => {
    it('should generate an ASS file without timings', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('Test Verse Line 1\nTest Verse Line 2');
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { });
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { });

      const result = await subtitle.generateSubtitles(
        1, 1, 7, '#FFFFFF', '1920,1080', 'Arial', 20, 10
      );
      expect(result).toContain('.ass');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should generate an ASS file with verse timings', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('Test Verse Line 1\nTest Verse Line 2');
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { });
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { });

      const timings = [
        { verse_num: 1, start: 0, end: 5 },
        { verse_num: 2, start: 5, end: 10 }
      ];
      const result = await subtitle.generateSubtitles(
        1, 1, 2, '#FFFFFF', '1920,1080', 'Arial', 20, 10, null, timings
      );
      expect(result).toContain('.ass');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error if text file is missing', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      await expect(subtitle.generateSubtitles(99, 1, 1, 'c', 'p', 'f', 1)).rejects.toThrow('Subtitle gen failed: Text file missing');
    });
  });
});