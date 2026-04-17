import { spawn } from 'node:child_process';

export function spawnTsx(entrypoint, args = [], options = {}) {
  return spawn(process.execPath, ['--import', 'tsx', entrypoint, ...args], options);
}
