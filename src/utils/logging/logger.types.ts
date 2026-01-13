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

/**
 * Interface for structured data that can be attached to log messages
 * @interface
 */
export interface LogData {
  /**
   * Any key-value pairs to include in the log
   */
  [key: string]: unknown;
}

/**
 * Configuration options for the Logger
 * @interface
 */
export interface LoggerOptions {
  /**
   * The minimum level of messages to log
   */
  minLevel?: import('./logger').LogLevel;
  /**
   * Whether to include timestamps in log messages
   */
  includeTimestamp?: boolean;
  /**
   * Whether to colorize log output
   */
  colorize?: boolean;
  /**
   * Whether to write logs to a file (server-side only)
   */
  logToFile?: boolean;
  /**
   * Path to the log file if logToFile is enabled
   */
  filePath?: string;
}

/**
 * Available color keys for log formatting
 * @typedef ColorKey
 */
export type ColorKey =
  | 'reset'
  | 'red'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'gray'
  | 'bold'
  | 'magenta'
  | 'cyan'
  | 'white';

/**
 * Log level strings for type safety
 */
export type LogLevelString = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'action' | 'success';

/**
 * Structured log entry for transport/storage
 * @interface
 */
export interface LogEntry {
  /** ISO timestamp of the log */
  timestamp: string;
  /** Log level */
  level: LogLevelString;
  /** Logger context/category */
  context: string;
  /** Log message */
  message: string;
  /** Optional structured data */
  data?: LogData;
  /** Environment (client/server) */
  environment: 'client' | 'server';
}

/**
 * Interface for custom log transports
 * @interface
 */
export interface LogTransport {
  /** Transport name for identification */
  name: string;
  /** Method to write a log entry */
  write(entry: LogEntry): void | Promise<void>;
}

/**
 * Options for the @Log decorator
 * @interface
 */
export interface LogMethodOptions {
  /** Whether to log method arguments (default: true) */
  logArgs?: boolean;
  /** Whether to log return value (default: false) */
  logResult?: boolean;
  /** Custom message prefix */
  message?: string;
  /** Log level to use (default: 'debug') */
  level?: LogLevelString;
}

/**
 * Options for the @LogTiming decorator
 * @interface
 */
export interface LogTimingOptions {
  /** Custom label for timing logs */
  label?: string;
  /** Threshold in ms - only log if execution exceeds this (default: 0) */
  threshold?: number;
  /** Log level to use (default: 'info') */
  level?: LogLevelString;
}

/**
 * Options for the @LogError decorator
 * @interface
 */
export interface LogErrorOptions {
  /** Whether to rethrow the error after logging (default: true) */
  rethrow?: boolean;
  /** Custom error message prefix */
  message?: string;
  /** Whether to log the stack trace (default: true) */
  includeStack?: boolean;
}

/**
 * Options for the @LogClass decorator
 * @interface
 */
export interface LogClassOptions {
  /** Methods to exclude from logging */
  exclude?: string[];
  /** Whether to log all method calls (default: true) */
  logCalls?: boolean;
  /** Whether to time all method calls (default: false) */
  timing?: boolean;
}
