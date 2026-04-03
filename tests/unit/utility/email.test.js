import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('email.js', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('should successfully send a verification email', async () => {
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.APP_URL = 'http://test-app.com';
        const { sendVerificationEmail } = await import('../../../utility/email.js');

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'msg_123' })
        });

        const result = await sendVerificationEmail('test@example.com', 'token123');

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('token123')
        }));
    });

    it('should successfully send a password reset email', async () => {
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.APP_URL = 'http://test-app.com';
        const { sendPasswordResetEmail } = await import('../../../utility/email.js');

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'msg_456' })
        });

        const result = await sendPasswordResetEmail('user@test.com', 'reset-token');

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            body: expect.stringContaining('http://test-app.com/?token=reset-token')
        }));
    });

    it('should return false if RESEND_API_KEY is missing', async () => {
        delete process.env.RESEND_API_KEY;
        const { sendVerificationEmail } = await import('../../../utility/email.js');

        const result = await sendVerificationEmail('test@example.com', 'token');
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY is not configured'));
    });

    it('should handle Resend API errors', async () => {
        process.env.RESEND_API_KEY = 're_test_key';
        const { sendVerificationEmail } = await import('../../../utility/email.js');

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({ message: 'Invalid API key' })
        });

        const result = await sendVerificationEmail('test@example.com', 'token');
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalled();
    });
});