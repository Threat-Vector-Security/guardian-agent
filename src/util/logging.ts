/**
 * Structured logging via pino.
 */

import pino from 'pino';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: process.env['NODE_ENV'] !== 'production'
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
});

/** Create a child logger with component context. */
export function createLogger(component: string): pino.Logger {
  return logger.child({ component });
}
