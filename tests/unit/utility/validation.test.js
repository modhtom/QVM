import { describe, it, expect } from 'vitest';
import * as validation from '../../../utility/validation.js';

describe('validation.js Unit Tests', () => {
    describe('validateUsername', () => {
        it('should return error for missing username', () => {
            expect(validation.validateUsername()).toBe('Username is required');
        });
        it('should return error for short username', () => {
            expect(validation.validateUsername('ab')).toBe('Username must be 3-30 characters');
        });
        it('should return error for invalid characters', () => {
             expect(validation.validateUsername('u!er')).toBe('Username can only contain letters, numbers, and underscores');
        });
        it('should return null for valid username', () => {
            expect(validation.validateUsername('user_123')).toBeNull();
        });
    });

    describe('validateEmail', () => {
        it('should return null for valid email', () => {
            expect(validation.validateEmail('t@t.com')).toBeNull();
        });
        it('should return error for invalid email', () => {
            expect(validation.validateEmail('invalid')).toBe('Invalid email format');
        });
    });

    describe('validatePassword', () => {
        it('should return null for valid password', () => {
            expect(validation.validatePassword('password123')).toBeNull();
        });
        it('should return error for short password', () => {
            expect(validation.validatePassword('123')).toBe('Password must be at least 6 characters');
        });
    });

    describe('validateSafeUrl', () => {
        it('should return error for loopback address', async () => {
            const res = await validation.validateSafeUrl('http://127.0.0.1/test');
            expect(res).toContain('Access to private or local network is forbidden');
        });

        it('should return error for private class A network', async () => {
            const res = await validation.validateSafeUrl('http://10.0.1.5/test');
            expect(res).toContain('Access to private or local network is forbidden');
        });

        it('should return error for link-local address', async () => {
            const res = await validation.validateSafeUrl('http://169.254.169.254/latest/meta-data');
            expect(res).toContain('Access to private or local network is forbidden');
        });

        it('should return error for loopback domain localhost', async () => {
            const res = await validation.validateSafeUrl('http://localhost:3000/info');
            expect(res).toContain('Access to private or local network is forbidden');
        });

        it('should return null for valid public url', async () => {
            const res = await validation.validateSafeUrl('https://unsplash.com/photos');
            expect(res).toBeNull();
        });

        it('should return error for invalid protocols', async () => {
            const res = await validation.validateSafeUrl('ftp://example.com/file');
            expect(res).toBe('Only HTTP and HTTPS protocols are allowed');
        });
    });
});
