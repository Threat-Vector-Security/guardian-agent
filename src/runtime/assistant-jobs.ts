/**
 * Assistant background job tracker.
 *
 * Tracks high-level jobs (intel scans, config apply, scheduled maintenance)
 * so operators can inspect what is running and what recently failed.
 */

export type AssistantJobStatus = 'running' | 'succeeded' | 'failed';
export type AssistantJobSource = 'manual' | 'scheduled' | 'system';

export interface AssistantJobRecord {
  id: string;
  type: string;
  source: AssistantJobSource;
  status: AssistantJobStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  detail?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AssistantJobSummary {
  total: number;
  running: number;
  succeeded: number;
  failed: number;
  lastStartedAt?: number;
  lastCompletedAt?: number;
}

export interface AssistantJobState {
  summary: AssistantJobSummary;
  jobs: AssistantJobRecord[];
}

export interface AssistantJobInput {
  type: string;
  source?: AssistantJobSource;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface AssistantJobTrackerOptions {
  maxJobs?: number;
  now?: () => number;
}

const DEFAULT_MAX_JOBS = 400;

let nextJobId = 1;
function createJobId(now: number): string {
  return `job-${now}-${nextJobId++}`;
}

export class AssistantJobTracker {
  private readonly maxJobs: number;
  private readonly now: () => number;
  private readonly jobs: AssistantJobRecord[] = [];

  constructor(options: AssistantJobTrackerOptions = {}) {
    this.maxJobs = options.maxJobs ?? DEFAULT_MAX_JOBS;
    this.now = options.now ?? Date.now;
  }

  async run<T>(input: AssistantJobInput, handler: () => Promise<T>): Promise<T> {
    const startedAt = this.now();
    const job: AssistantJobRecord = {
      id: createJobId(startedAt),
      type: input.type,
      source: input.source ?? 'system',
      status: 'running',
      startedAt,
      detail: input.detail,
      metadata: input.metadata,
    };
    this.jobs.unshift(job);
    this.enforceMax();

    try {
      const result = await handler();
      const completedAt = this.now();
      job.status = 'succeeded';
      job.completedAt = completedAt;
      job.durationMs = Math.max(0, completedAt - startedAt);
      return result;
    } catch (err) {
      const completedAt = this.now();
      job.status = 'failed';
      job.completedAt = completedAt;
      job.durationMs = Math.max(0, completedAt - startedAt);
      job.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  getState(limit = 50): AssistantJobState {
    const jobs = this.jobs.slice(0, Math.max(1, limit));
    let running = 0;
    let succeeded = 0;
    let failed = 0;
    let lastStartedAt: number | undefined;
    let lastCompletedAt: number | undefined;

    for (const job of this.jobs) {
      if (!lastStartedAt || job.startedAt > lastStartedAt) {
        lastStartedAt = job.startedAt;
      }
      if (job.completedAt && (!lastCompletedAt || job.completedAt > lastCompletedAt)) {
        lastCompletedAt = job.completedAt;
      }

      if (job.status === 'running') running += 1;
      else if (job.status === 'succeeded') succeeded += 1;
      else failed += 1;
    }

    return {
      summary: {
        total: this.jobs.length,
        running,
        succeeded,
        failed,
        lastStartedAt,
        lastCompletedAt,
      },
      jobs,
    };
  }

  private enforceMax(): void {
    if (this.jobs.length <= this.maxJobs) return;
    this.jobs.splice(this.maxJobs);
  }
}

