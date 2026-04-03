import { describe, it, expect, beforeEach } from 'vitest';
import {
    metrics,
    recordRequest,
    recordJobSuccess,
    recordJobFailure,
    recordError,
    getMetricsSummary
} from '../../../utility/metrics.js';

describe('metrics.js', () => {
    beforeEach(() => {
        metrics.totalRequests = 0;
        metrics.successfulJobs = 0;
        metrics.failedJobs = 0;
        metrics.activeUsers = new Set();
        metrics.jobProcessingTimes = [];
        metrics.errorsLogged = 0;
        metrics.startTime = Date.now() - 10000;
    });

    it('should record requests and optionally active users', () => {
        recordRequest({ user: null });
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.activeUsers.size).toBe(0);

        recordRequest({ user: { id: 1 } });
        expect(metrics.totalRequests).toBe(2);
        expect(metrics.activeUsers.size).toBe(1);
    });

    it('should record job success and track processing times', () => {
        recordJobSuccess(5000);
        recordJobSuccess();

        expect(metrics.successfulJobs).toBe(2);
        expect(metrics.jobProcessingTimes.length).toBe(1);
        expect(metrics.jobProcessingTimes[0]).toBe(5000);
    });

    it('should maintain a limit of 1000 job processing times', () => {
        metrics.jobProcessingTimes = new Array(1000).fill(1000);
        recordJobSuccess(2000);

        expect(metrics.jobProcessingTimes.length).toBe(1000);
        expect(metrics.jobProcessingTimes[999]).toBe(2000);
    });

    it('should record job failures', () => {
        recordJobFailure();
        recordJobFailure();
        expect(metrics.failedJobs).toBe(2);
    });

    it('should record errors', () => {
        recordError();
        expect(metrics.errorsLogged).toBe(1);
    });

    it('should generate a correct metrics summary', () => {
        recordJobSuccess(4000);
        recordJobSuccess(6000);
        recordRequest({ user: { id: 1 } });
        recordRequest({ user: { id: 2 } });
        recordJobFailure();
        recordError();

        const summary = getMetricsSummary();
        expect(summary.totalRequests).toBe(2);
        expect(summary.successfulJobs).toBe(2);
        expect(summary.failedJobs).toBe(1);
        expect(summary.uniqueUsersCurrentSession).toBe(2);
        expect(summary.averageJobTimeSeconds).toBe('5.00');
        expect(summary.errorsLogged).toBe(1);
        expect(summary.uptimeSeconds).toBeGreaterThanOrEqual(10);
    });

    it('should handle zero job processing times safely', () => {
        const summary = getMetricsSummary();
        expect(summary.averageJobTimeSeconds).toBe('0.00');
    });
});