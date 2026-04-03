import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMetaData } from '../../../utility/fetchMetaData.js';
import axios from 'axios';
import fs from 'fs';

vi.mock('axios');
vi.mock('fs');

describe('fetchMetaData.js', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should successfully fetch reciters and translations and save to file', async () => {
        const mockReciters = {
            data: {
                reciters: [
                    { id: 1, name: 'Reciter 1', letter: 'R', moshaf: [{ id: 10, name: 'M1', server: 'S1', surah_list: '1,2', surah_total: 2 }] }
                ]
            }
        };
        const mockTranslations = {
            data: {
                data: [
                    { identifier: 'en.test', name: 'Test English', englishName: 'Test English', language: 'en', direction: 'ltr' }
                ]
            }
        };

        axios.get.mockImplementation((url) => {
            if (url.includes('mp3quran.net')) return Promise.resolve(mockReciters);
            if (url.includes('alquran.cloud')) return Promise.resolve(mockTranslations);
            return Promise.reject(new Error('Unknown URL'));
        });

        await fetchMetaData();

        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('metadata.json'),
            expect.stringContaining('"reciters"')
        );

        const savedData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(savedData.reciters).toHaveLength(1);
        expect(savedData.translations).toHaveLength(1);
        expect(savedData.timestamp).toBeDefined();
    });

    it('should handle empty responses gracefully', async () => {
        axios.get.mockResolvedValue({ data: {} });

        await fetchMetaData();

        expect(fs.writeFileSync).toHaveBeenCalled();
        const savedData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(savedData.reciters).toEqual([]);
        expect(savedData.translations).toEqual([]);
    });

    it('should handle API errors', async () => {
        const errorSpy = vi.spyOn(console, 'error');
        axios.get.mockRejectedValue(new Error('API Down'));

        await fetchMetaData();

        expect(errorSpy).toHaveBeenCalled();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
});