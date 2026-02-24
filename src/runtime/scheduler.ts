/**
 * Cron scheduler — periodic agent invocations using croner.
 *
 * ESM-native, no native deps. Wraps croner to provide
 * a simple schedule/start/stop API.
 */

import { Cron } from 'croner';
import { createLogger } from '../util/logging.js';

const log = createLogger('scheduler');

export interface ScheduledJob {
  agentId: string;
  cron: string;
  callback: () => Promise<void>;
  job: Cron;
}

export class CronScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private running = false;

  /** Schedule a periodic job for an agent. */
  schedule(
    agentId: string,
    cronExpr: string,
    callback: () => Promise<void>,
  ): void {
    const key = `${agentId}:${cronExpr}`;

    if (this.jobs.has(key)) {
      throw new Error(`Job already scheduled: ${key}`);
    }

    const job = new Cron(cronExpr, {
      paused: !this.running,
    }, async () => {
      try {
        await callback();
      } catch (err) {
        log.error({ agentId, cron: cronExpr, err }, 'Scheduled job failed');
      }
    });

    this.jobs.set(key, { agentId, cron: cronExpr, callback, job });
    log.info({ agentId, cron: cronExpr }, 'Job scheduled');
  }

  /** Remove all jobs for an agent. */
  unschedule(agentId: string): void {
    for (const [key, job] of this.jobs.entries()) {
      if (job.agentId === agentId) {
        job.job.stop();
        this.jobs.delete(key);
      }
    }
  }

  /** Start all scheduled jobs. */
  start(): void {
    if (this.running) return;
    this.running = true;

    for (const job of this.jobs.values()) {
      job.job.resume();
    }

    log.info({ jobCount: this.jobs.size }, 'Scheduler started');
  }

  /** Stop all scheduled jobs. */
  stop(): void {
    this.running = false;

    for (const job of this.jobs.values()) {
      job.job.stop();
    }

    log.info('Scheduler stopped');
  }

  /** Get all scheduled jobs. */
  getJobs(): ScheduledJob[] {
    return [...this.jobs.values()];
  }

  /** Whether the scheduler is running. */
  isRunning(): boolean {
    return this.running;
  }
}
