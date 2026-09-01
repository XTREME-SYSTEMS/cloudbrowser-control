// Auto-Scaling Module
// Monitors queue depth and adjusts pool size dynamically
// Implements serverless-like elastic scaling for browser sessions

export interface ScaleDecision {
  action: 'scale_up' | 'scale_down' | 'hold';
  currentPool: number;
  targetPool: number;
  reason: string;
  queueDepth: number;
  activeSessions: number;
}

export function computeScaleDecision(params: {
  currentPoolSize: number;
  activeSessions: number;
  queuedJobs: number;
  minPool: number;
  maxPool: number;
  targetQueueDepth: number;
  cpuUsage?: number;
}): ScaleDecision {
  const { currentPoolSize, activeSessions, queuedJobs, minPool, maxPool, targetQueueDepth, cpuUsage } = params;

  // If queue depth exceeds target, scale up
  if (queuedJobs > targetQueueDepth) {
    const needed = Math.ceil(queuedJobs / 3); // ~3 jobs per session
    const target = Math.min(maxPool, Math.max(currentPoolSize + 1, needed));
    if (target > currentPoolSize) {
      return {
        action: 'scale_up',
        currentPool: currentPoolSize,
        targetPool: target,
        reason: `Queue depth ${queuedJobs} exceeds target ${targetQueueDepth}`,
        queueDepth: queuedJobs,
        activeSessions,
      };
    }
  }

  // If CPU is high and queue is manageable, scale up for capacity
  if (cpuUsage !== undefined && cpuUsage > 80 && queuedJobs > 0) {
    const target = Math.min(maxPool, currentPoolSize + 2);
    return {
      action: 'scale_up',
      currentPool: currentPoolSize,
      targetPool: target,
      reason: `CPU usage ${cpuUsage}% with ${queuedJobs} queued jobs`,
      queueDepth: queuedJobs,
      activeSessions,
    };
  }

  // If no queue and sessions are idle, scale down
  if (queuedJobs === 0 && activeSessions < currentPoolSize * 0.5) {
    const target = Math.max(minPool, Math.floor(currentPoolSize * 0.7));
    if (target < currentPoolSize) {
      return {
        action: 'scale_down',
        currentPool: currentPoolSize,
        targetPool: target,
        reason: `No queue and ${activeSessions} active sessions (< 50% of pool ${currentPoolSize})`,
        queueDepth: queuedJobs,
        activeSessions,
      };
    }
  }

  return {
    action: 'hold',
    currentPool: currentPoolSize,
    targetPool: currentPoolSize,
    reason: 'Within target parameters',
    queueDepth: queuedJobs,
    activeSessions,
  };
}

// Priority-based job dequeue — higher priority (lower number) first, FIFO within same priority
export function dequeueNextJob<T extends { priority: number; created_date?: string }>(queuedJobs: T[]): T | null {
  if (queuedJobs.length === 0) return null;
  const sorted = [...queuedJobs].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    // FIFO within same priority — earlier created_date first
    const aDate = a.created_date || '';
    const bDate = b.created_date || '';
    return aDate.localeCompare(bDate);
  });
  return sorted[0];
}

// Compute pool warm count based on historical usage
export function computeWarmCount(params: {
  avgSessionDurationMin: number;
  jobsPerHour: number;
  maxPool: number;
}): number {
  const { avgSessionDurationMin, jobsPerHour, maxPool } = params;
  // sessions needed = (jobs per hour * avg duration in hours)
  const sessionsNeeded = Math.ceil((jobsPerHour / 60) * avgSessionDurationMin);
  return Math.min(maxPool, Math.max(1, Math.floor(sessionsNeeded * 0.3))); // 30% warm
}