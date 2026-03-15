export const metrics = {
  totalRequests: 0,
  successfulJobs: 0,
  failedJobs: 0,
  activeUsers: new Set(),
  jobProcessingTimes: [], // array of milliseconds
  errorsLogged: 0,
  startTime: Date.now()
};

export function recordRequest(req) {
  metrics.totalRequests++;
  if (req.user) {
    metrics.activeUsers.add(req.user.id);
  }
}

export function recordJobSuccess(timeMs) {
  metrics.successfulJobs++;
  if (timeMs) {
    metrics.jobProcessingTimes.push(timeMs);
    if (metrics.jobProcessingTimes.length > 1000) {
      metrics.jobProcessingTimes.shift();
    }
  }
}

export function recordJobFailure() {
  metrics.failedJobs++;
}

export function recordError() {
  metrics.errorsLogged++;
}

export function getMetricsSummary() {
  const avgTime = metrics.jobProcessingTimes.length
    ? metrics.jobProcessingTimes.reduce((a, b) => a + b, 0) / metrics.jobProcessingTimes.length
    : 0;

  return {
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
    totalRequests: metrics.totalRequests,
    successfulJobs: metrics.successfulJobs,
    failedJobs: metrics.failedJobs,
    uniqueUsersCurrentSession: metrics.activeUsers.size,
    averageJobTimeSeconds: (avgTime / 1000).toFixed(2),
    errorsLogged: metrics.errorsLogged
  };
}
