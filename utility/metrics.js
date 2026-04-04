import { recordEvent, getJobAggregations, getSystemEventsCount, getActiveUsersCount, getTotalVideosCount } from './db.js';

export const metrics = {
  totalRequests: 0,
  startTime: Date.now()
};

export function recordRequest(req) {
  metrics.totalRequests++;
}

export async function recordError() {
  try { await recordEvent('error'); } catch (e) { }
}

export async function recordRateLimit() {
  try { await recordEvent('rate_limit'); } catch (e) { }
}

export async function getMetricsSummary() {
  const aggs = await getJobAggregations();
  const errorsLogged = await getSystemEventsCount('error');
  const activeUsers = await getActiveUsersCount();
  const totalVideos = await getTotalVideosCount();

  return {
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
    totalRequests: metrics.totalRequests,
    totalJobs: aggs?.totalJobs || 0,
    successfulJobs: aggs?.successfulJobs || 0,
    failedJobs: aggs?.failedJobs || 0,
    uniqueUsersCurrentSession: activeUsers || 0,
    averageJobTimeSeconds: aggs?.avgDuration ? (aggs.avgDuration / 1000).toFixed(2) : 0,
    errorsLogged: errorsLogged || 0,
    totalVideos: totalVideos || 0
  };
}