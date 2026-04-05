import type { PerformanceProfileConfig } from '../../config/types.js';
import { PerformanceCapabilities, PerformanceProcessSummary, PerformanceSnapshot } from '../../channels/web-types.js';

export interface PerformanceAdapter {
  getCapabilities(): PerformanceCapabilities;
  collectSnapshot(): Promise<PerformanceSnapshot>;
  listProcesses(): Promise<PerformanceProcessSummary[]>;
  terminateProcesses(processes: PerformanceProcessSummary[]): Promise<{ success: boolean; message: string }>;
  runCleanupActions(actionIds: string[]): Promise<{ success: boolean; message: string }>;
  applyProfile(profile: PerformanceProfileConfig): Promise<{ success: boolean; message: string }>;
}
