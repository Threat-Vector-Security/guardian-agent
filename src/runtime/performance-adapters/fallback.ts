import os from 'node:os';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

import type { PerformanceProfileConfig } from '../../config/types.js';
import type { PerformanceCapabilities, PerformanceProcessSummary, PerformanceSnapshot } from '../../channels/web-types.js';
import type { PerformanceAdapter } from './types.js';

const execFile = promisify(execFileCallback);

interface CpuSample {
  idle: number;
  total: number;
}

function readCpuSample(): CpuSample {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }

  return { idle, total };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toProcessTargetId(pid: number): string {
  return `pid:${pid}`;
}

function sortProcesses(processes: PerformanceProcessSummary[]): PerformanceProcessSummary[] {
  return [...processes].sort((a, b) => {
    const cpuDelta = (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0);
    if (cpuDelta !== 0) return cpuDelta;
    return (b.memoryMb ?? 0) - (a.memoryMb ?? 0);
  });
}

async function readUnixProcesses(): Promise<PerformanceProcessSummary[]> {
  try {
    const { stdout } = await execFile('ps', ['-eo', 'pid=,comm=,%cpu=,rss='], {
      maxBuffer: 8 * 1024 * 1024,
    });
    const results: PerformanceProcessSummary[] = [];
    for (const line of stdout.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
      const match = line.match(/^(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)$/);
      if (!match) continue;
      const [, pidRaw, name, cpuRaw, rssRaw] = match;
      const pid = Number(pidRaw);
      const cpuPercent = Number(cpuRaw);
      const rssKb = Number(rssRaw);
      if (!Number.isFinite(pid) || !name) continue;
      results.push({
        targetId: toProcessTargetId(pid),
        pid,
        name,
        cpuPercent: Number.isFinite(cpuPercent) ? round(cpuPercent) : undefined,
        memoryMb: Number.isFinite(rssKb) ? round(rssKb / 1024) : undefined,
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function readUnixDiskUsageMb(): Promise<{ freeMb: number; totalMb: number }> {
  try {
    const { stdout } = await execFile('df', ['-kP', '/'], {
      maxBuffer: 512 * 1024,
    });
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const dataLine = lines[1];
    if (!dataLine) return { freeMb: 0, totalMb: 0 };
    const columns = dataLine.split(/\s+/);
    if (columns.length < 6) return { freeMb: 0, totalMb: 0 };
    const totalKb = Number(columns[1]);
    const freeKb = Number(columns[3]);
    return {
      freeMb: Number.isFinite(freeKb) ? round(freeKb / 1024) : 0,
      totalMb: Number.isFinite(totalKb) ? round(totalKb / 1024) : 0,
    };
  } catch {
    return { freeMb: 0, totalMb: 0 };
  }
}

export class FallbackPerformanceAdapter implements PerformanceAdapter {
  private previousCpuSample: CpuSample | null = null;

  getCapabilities(): PerformanceCapabilities {
    return {
      canManageProcesses: false,
      canManagePower: false,
      canRunCleanup: false,
      canProbeLatency: true,
      supportedActionIds: [],
    };
  }

  private readCpuPercent(): number {
    const sample = readCpuSample();
    if (!this.previousCpuSample) {
      this.previousCpuSample = sample;
      return 0;
    }

    const idleDelta = sample.idle - this.previousCpuSample.idle;
    const totalDelta = sample.total - this.previousCpuSample.total;
    this.previousCpuSample = sample;

    if (totalDelta <= 0) return 0;
    return round(Math.max(0, Math.min(100, (1 - (idleDelta / totalDelta)) * 100)));
  }

  async collectSnapshot(): Promise<PerformanceSnapshot> {
    const [processes, disk] = await Promise.all([
      this.listProcesses(),
      readUnixDiskUsageMb(),
    ]);
    const totalMemoryMb = os.totalmem() / (1024 * 1024);
    const usedMemoryMb = totalMemoryMb - (os.freemem() / (1024 * 1024));
    return {
      cpuPercent: this.readCpuPercent(),
      memoryMb: round(usedMemoryMb),
      memoryTotalMb: round(totalMemoryMb),
      memoryPercent: totalMemoryMb > 0 ? round((usedMemoryMb / totalMemoryMb) * 100) : undefined,
      diskFreeMb: round(disk.freeMb),
      diskTotalMb: round(disk.totalMb),
      diskPercentFree: disk.totalMb > 0 ? round((disk.freeMb / disk.totalMb) * 100) : undefined,
      activeProfile: 'balanced',
      processCount: processes.length,
      topProcesses: sortProcesses(processes).slice(0, 5),
      sampledAt: Date.now(),
    };
  }

  async listProcesses(): Promise<PerformanceProcessSummary[]> {
    return sortProcesses(await readUnixProcesses());
  }

  async terminateProcesses(_processes: PerformanceProcessSummary[]): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: `Process actions are not supported on ${process.platform}.`,
    };
  }

  async runCleanupActions(actionIds: string[]): Promise<{ success: boolean; message: string }> {
    if (actionIds.length === 0) {
      return { success: true, message: 'No cleanup actions were selected.' };
    }
    return {
      success: false,
      message: `Cleanup actions are not supported on ${process.platform}.`,
    };
  }

  async applyProfile(_profile: PerformanceProfileConfig): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Guardian switched profiles. Host power-mode changes are not supported on ${process.platform}.`,
    };
  }
}
