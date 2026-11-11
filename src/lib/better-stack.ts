/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Logtail } from '@logtail/node';
import { env } from '@/env';

const sourceToken = env.BETTERSTACK_SOURCE_TOKEN?.trim();
const ingestingEndpoint = env.BETTERSTACK_INGESTING_HOST?.trim()
  ? `https://${env.BETTERSTACK_INGESTING_HOST.trim().replace(/^https?:\/\//, '')}`
  : undefined;

/**
 * The logging calls this module makes, which both Logtail and the console fallback answer.
 */
export interface BetterStackLogger {
  debug(message: string, context?: LogContext): unknown;
  info(message: string, context?: LogContext): unknown;
  warn(message: string, context?: LogContext): unknown;
  error(message: string, context?: LogContext): unknown;
  flush(): Promise<unknown>;
}

/**
 * Writes one level to the console method of the same name, with the context only when given.
 */
const toConsole =
  (level: LogLevel) =>
  (message: string, context?: LogContext): void => {
    if (context) console[level](message, context);
    else console[level](message);
  };

/** Logs to the console, for when logs are not sent to Better Stack. */
const consoleLogger: BetterStackLogger = {
  debug: toConsole('debug'),
  info: toConsole('info'),
  warn: toConsole('warn'),
  error: toConsole('error'),
  flush: async () => {},
};

/**
 * Builds the logger at module load without ever throwing: every /api/v1 route imports this
 * module, so a throw here takes the whole API down.
 *
 * - Sends to Better Stack only when both BETTERSTACK_SOURCE_TOKEN and BETTERSTACK_INGESTING_HOST
 *   are set, since @logtail/node 0.6 throws when asked to send without an endpoint.
 *   (BETTERSTACK_API_KEY is an Uptime API token and cannot authenticate Logtail ingestion.)
 * - Otherwise logs to the console, warning once which variables are missing, by name only.
 * - Falls back to the console the same way if Logtail throws for any other reason.
 */
function createLogger(): BetterStackLogger {
  if (!sourceToken || !ingestingEndpoint) {
    const missing = [
      sourceToken ? null : 'BETTERSTACK_SOURCE_TOKEN',
      ingestingEndpoint ? null : 'BETTERSTACK_INGESTING_HOST',
    ].filter((name) => name !== null);
    console.warn(
      `[better-stack] Log sending is off: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set. Logging to the console.`,
    );
    return consoleLogger;
  }

  try {
    return new Logtail(sourceToken, {
      endpoint: ingestingEndpoint,
      // Send logs in batches for better performance
      batchSize: 100,
      batchInterval: 1000,
      sendLogsToConsoleOutput: env.NODE_ENV === 'development',
      sendLogsToBetterStack: true,
      ignoreExceptions: true,
    });
  } catch (error) {
    console.warn(
      `[better-stack] Log sending is off: the Logtail client failed to start (${error instanceof Error ? error.message : 'unknown error'}). Logging to the console.`,
    );
    return consoleLogger;
  }
}

/**
 * Better Stack (Logtail) logger, used for structured logging and error tracking.
 * Ships logs to Better Stack Telemetry when it is fully configured and to the console otherwise.
 */
export const logger: BetterStackLogger = createLogger();

/**
 * Log levels for Better Stack
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log context
 */
export interface LogContext {
  [key: string]: unknown;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: Error | string;
}

/**
 * Log a message with structured context
 */
export function log(level: LogLevel, message: string, context?: LogContext): void {
  switch (level) {
    case 'debug':
      logger.debug(message, context);
      break;
    case 'info':
      logger.info(message, context);
      break;
    case 'warn':
      logger.warn(message, context);
      break;
    case 'error':
      logger.error(message, context);
      break;
  }
}

/**
 * Log API request/response
 */
export function logAPIRequest(params: {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
  error?: Error;
}): void {
  const { method, path, statusCode, duration, ip, userAgent, userId, error } = params;

  const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  log(level, `${method} ${path} ${statusCode}`, {
    method,
    path,
    statusCode,
    duration,
    ip,
    userAgent,
    userId,
    error: error?.message,
    stack: error?.stack,
  });
}

/**
 * Log error with full context
 */
export function logError(error: Error, context?: LogContext): void {
  log('error', error.message, {
    ...context,
    error: error.message,
    stack: error.stack,
    name: error.name,
  });
}

/**
 * Create a middleware-friendly logger for tracking request/response
 */
export function createRequestLogger() {
  return {
    start: (req: Request) => {
      const start = Date.now();
      const path = new URL(req.url).pathname;
      const method = req.method;

      return {
        end: (statusCode: number, error?: Error) => {
          const duration = Date.now() - start;

          logAPIRequest({
            method,
            path,
            statusCode,
            duration,
            ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
            userAgent: req.headers.get('user-agent') ?? undefined,
            error,
          });
        },
      };
    },
  };
}

/**
 * Flush logs before process exit
 * Call this in graceful shutdown handlers
 */
export async function flushLogs(): Promise<void> {
  await logger.flush();
}

// Ensure logs are flushed on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    flushLogs().catch(console.error);
  });

  process.on('SIGINT', () => {
    flushLogs()
      .catch(console.error)
      .finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    flushLogs()
      .catch(console.error)
      .finally(() => process.exit(0));
  });
}

/**
 * Helper to log performance metrics
 */
export function logPerformance(
  operation: string,
  duration: number,
  context?: Record<string, unknown>,
): void {
  const level: LogLevel = duration > 5000 ? 'warn' : duration > 2000 ? 'info' : 'debug';

  log(level, `Performance: ${operation}`, {
    operation,
    duration,
    ...context,
  });
}

/**
 * Helper to log security events
 */
export function logSecurityEvent(
  event: string,
  context?: LogContext & {
    severity?: 'low' | 'medium' | 'high' | 'critical';
  },
): void {
  const level: LogLevel =
    context?.severity === 'critical' || context?.severity === 'high' ? 'error' : 'warn';

  log(level, `Security: ${event}`, {
    event,
    ...context,
  });
}

export default logger;
