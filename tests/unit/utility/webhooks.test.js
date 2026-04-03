import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { sendWebhookNotification } from '../../../utility/webhooks.js';
import { logger } from '../../../utility/logger.js';

vi.mock('axios');
vi.mock('../../../utility/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    }
}));

describe('webhooks.js', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should not send anything if WEBHOOK_URL is not configured', async () => {
        delete process.env.WEBHOOK_URL;
        await sendWebhookNotification('TEST_EVENT', { data: 'test' });
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('should send standard webhook if URL is generic', async () => {
        process.env.WEBHOOK_URL = 'http://example.com/webhook';
        axios.post.mockResolvedValue({});

        await sendWebhookNotification('SERVER_STARTED', { port: 3000 });

        expect(axios.post).toHaveBeenCalledWith('http://example.com/webhook', {
            event: 'SERVER_STARTED',
            timestamp: expect.any(String),
            payload: { port: 3000 }
        }, { timeout: 5000 });
        expect(logger.info).toHaveBeenCalledWith('Webhook sent for event: SERVER_STARTED');
    });

    it('should format payload correctly for Discord webhooks', async () => {
        process.env.WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';
        axios.post.mockResolvedValue({});

        await sendWebhookNotification('API_ERROR', { error: 'Test error' });

        expect(axios.post).toHaveBeenCalledTimes(1);
        const callArgs = axios.post.mock.calls[0];
        expect(callArgs[0]).toBe(process.env.WEBHOOK_URL);

        const payload = callArgs[1];
        expect(payload.username).toBe('QVM System');
        expect(payload.embeds).toBeDefined();
        expect(payload.embeds[0].title).toBe('System Event: API_ERROR');
        expect(payload.embeds[0].color).toBe(15158332); // Expected red for API_ERROR
        expect(payload.embeds[0].description).toContain('Test error');
    });

    it('should catch and log errors during webhook dispatch', async () => {
        process.env.WEBHOOK_URL = 'http://example.com/webhook';
        axios.post.mockRejectedValue(new Error('Network Timeouts'));

        await sendWebhookNotification('TEST_EVENT', { data: 'error' });

        expect(logger.error).toHaveBeenCalledWith('Failed to send webhook for event TEST_EVENT: Network Timeouts');
    });
});