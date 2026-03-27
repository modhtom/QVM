import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxios, mockCache } = vi.hoisted(() => ({
  mockAxios: { get: vi.fn() },
  mockCache: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('axios', () => ({ default: mockAxios }));
vi.mock('../../../utility/cache.js', () => ({ cache: mockCache }));
vi.mock('music-metadata', () => ({
  parseBuffer: vi.fn(),
}));

import { fetchFullSurahData } from '../../../utility/data.js';

describe('data.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchFullSurahData', () => {
    it('should return cached data if available', async () => {
      const mockData = { name: 'Al-Fatihah' };
      mockCache.get.mockResolvedValue(mockData);

      const result = await fetchFullSurahData(1, 'ar.alafasy');
      expect(result).toEqual(mockData);
      expect(mockCache.get).toHaveBeenCalledWith('surah:1:edition:ar.alafasy');
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('should fetch from API if not in cache', async () => {
      const mockResult = { data: { name: 'Al-Fatihah' } };
      mockCache.get.mockResolvedValue(null);
      mockAxios.get.mockResolvedValue({ data: mockResult });

      const result = await fetchFullSurahData(1, 'ar.alafasy');
      expect(result).toEqual(mockResult.data);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should throw error if API fails', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAxios.get.mockRejectedValue(new Error('Network Error'));

      await expect(fetchFullSurahData(1, 'ar.alafasy')).rejects.toThrow('Network Error');
    });
  });
});