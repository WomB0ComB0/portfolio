/**
 * Copyright 2025 Product Decoder
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
 * @fileoverview A comprehensive logging utility for both client and server environments.
 * Provides structured logging with support for different log levels, colorization,
 * and contextual information.
 */

/**
 * Determines if the code is running in a server environment
 */
const isServer = typeof window === 'undefined';

/**
 * Enum representing different logging levels with their priority values.
 * Higher values indicate more verbose logging.
 * @enum {number}
 */
export enum LogLevel {
  /** No logging */
  NONE = 0,
  /** Only error messages */
  ERROR = 1,
  /** Errors and warnings */
  WARN = 2,
  /** Errors, warnings, and informational messages */
  INFO = 3,
  /** Errors, warnings, info, and debug messages */
  DEBUG = 4,
  /** Errors, warnings, info, debug, and trace messages */
  TRACE = 5,
  /** All possible log messages */
  ALL = 6,
}

/**
 * Available color keys for log formatting
 * @typedef {'reset' | 'red' | 'yellow' | 'blue' | 'green' | 'gray' | 'bold' | 'magenta' | 'cyan' | 'white'} ColorKey
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
  minLevel?: LogLevel;

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
 * A versatile logging utility that works in both browser and Node.js environments.
 * Supports multiple log levels, colorized output, and structured data logging.
 */
export class Logger {
  /** The context/category name for this logger instance */
  private context: string;

  /** Whether this logger is running in a server environment */
  private isServerContext: boolean;

  /** The minimum log level that will be output */
  private minLevel: LogLevel;

  /** Whether to include ISO timestamps in log messages */
  private includeTimestamp: boolean;

  /** Whether to apply ANSI color codes to the output */
  private shouldColorize: boolean;

  /** Registry of logger instances to implement the singleton pattern */
  private static instances: Map<string, Logger> = new Map();

  /** ANSI color codes for terminal output */
  private colors: Record<ColorKey, string> = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    bold: '\x1b[1m',
  };

  /** Mapping of log levels to their display colors */
  private levelColors: Record<string, ColorKey> = {
    error: 'red',
    warn: 'yellow',
    info: 'blue',
    debug: 'gray',
    trace: 'cyan',
    action: 'magenta',
    success: 'green',
  };

  /**
   * Create a new Logger instance or return an existing one for the given context
   * @param {string} context - The context name for this logger (e.g., component or service name)
   * @param {LoggerOptions} [options={}] - Optional logger configuration
   */
  constructor(context: string, options: LoggerOptions = {}) {
    this.context = context;
    this.isServerContext = isServer;
    this.minLevel =
      options.minLevel ?? (process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.ALL);
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.shouldColorize = options.colorize ?? this.isServerContext;
  }

  /**
   * Get a logger instance for the given context.
   * If a logger with this context already exists, returns the existing instance.
   *
   * @param {string} context - The context name
   * @param {LoggerOptions} [options] - Optional logger configuration
   * @returns {Logger} A logger instance for the specified context
   */
  public static getLogger(context: string, options?: LoggerOptions): Logger {
    if (!Logger.instances.has(context)) {
      Logger.instances.set(context, new Logger(context, options));
    }
    return Logger.instances.get(context)!;
  }

  /**
   * Set global minimum log level for all logger instances
   *
   * @param {LogLevel} level - The minimum level to log across all loggers
   */
  public static setGlobalLogLevel(level: LogLevel): void {
    Logger.instances.forEach((logger) => {
      logger.minLevel = level;
    });
  }

  /**
   * Determine if the current environment should log messages at the specified level
   *
   * @param {LogLevel} level - The log level to check
   * @returns {boolean} Whether logging should occur for this level
   * @private
   */
  private shouldLog(level: LogLevel): boolean {
    // Check if level meets minimum threshold
    if (level > this.minLevel) return false;

    // Always log server-side actions
    if (this.isServerContext) return true;

    // Only log client-side in development or if explicitly enabled
    return process.env.NODE_ENV === 'development' || process.env.ENABLE_CLIENT_LOGS === 'true';
  }

  /**
   * Format a log message with metadata
   *
   * @param {string} level - The log level
   * @param {string} message - The message to log
   * @param {LogData} [data] - Optional data to include
   * @returns {Object} Formatted message with prefix and data
   * @private
   */
  private formatMessage(level: string, message: string, data?: LogData) {
    const timestamp = this.includeTimestamp ? new Date().toISOString() : '';
    const environment = this.isServerContext ? '[SERVER]' : '[CLIENT]';
    const prefix = `${timestamp} ${environment} ${this.context}:`;
    return { level, prefix, message, ...(data && { data }) };
  }

  /**
   * Apply color to text if colorization is enabled
   *
   * @param {ColorKey} color - The color to apply
   * @param {string} text - The text to colorize
   * @returns {string} Colorized text (if enabled) or original text
   * @private
   */
  private colorize(color: ColorKey, text: string): string {
    // Only apply colors if enabled
    if (!this.shouldColorize) return text;
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  /**
   * Format a log level indicator with brackets
   *
   * @param {string} level - The log level string
   * @returns {string} Formatted log level indicator
   * @private
   */
  private formatLogLevel(level: string): string {
    return `[${level.toUpperCase()}]`;
  }

  /**
   * Format the final log output combining all components
   *
   * @param {Object} params - The formatted log data
   * @param {string} params.prefix - The log prefix with context information
   * @param {string} params.message - The main log message
   * @param {LogData} [params.data] - Optional structured data to include
   * @returns {string} The complete formatted log message
   * @private
   */
  private formatOutput({
    prefix,
    message,
    data,
  }: {
    prefix: string;
    message: string;
    data?: LogData;
  }): string {
    const logParts = [prefix, message];

    if (data) {
      // Handle special cases like Error objects better
      if (data.error instanceof Error) {
        logParts.push('\nError Details:');
        logParts.push(`  Name: ${data.error.name}`);
        logParts.push(`  Message: ${data.error.message}`);
        if (data.error.stack) {
          logParts.push(`  Stack: ${data.error.stack}`);
        }

        // Remove error from data to avoid duplication
        const { error, ...restData } = data;
        if (Object.keys(restData).length > 0) {
          logParts.push('\nAdditional Data:');
          logParts.push(JSON.stringify(restData, null, 2));
        }
      } else {
        logParts.push('\n' + JSON.stringify(data, null, 2));
      }
    }

    return logParts.join(' ');
  }

  /**
   * Log an informational message
   *
   * @param {string} message - The message to log
   * @param {LogData} [data] - Optional data to include
   */
  info(message: string, data?: LogData): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const formattedData = this.formatMessage('info', message, data);
    console.log(
      this.colorize(this.levelColors.info!, this.formatLogLevel('info')) +
        ' ' +
        this.formatOutput(formattedData),
    );
  }

  /**
   * Log an error message
   *
   * @param {string} message - The error message
   * @param {Error|unknown} [error] - Optional Error object or unknown error
   * @param {LogData} [data] - Optional additional data
   */
  error(message: string, error?: Error | unknown, data?: LogData): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const errorData =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;

    const formattedData = this.formatMessage('error', message, {
      ...data,
      error: errorData,
    });

    console.error(
      this.colorize('bold', this.colorize(this.levelColors.error!, this.formatLogLevel('error'))) +
        ' ' +
        this.formatOutput(formattedData),
    );
  }

  /**
   * Log a warning message
   *
   * @param {string} message - The warning message
   * @param {LogData} [data] - Optional data to include
   */
  warn(message: string, data?: LogData): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const formattedData = this.formatMessage('warn', message, data);
    console.warn(
      this.colorize(this.levelColors.warn!, this.formatLogLevel('warn')) +
        ' ' +
        this.formatOutput(formattedData),
    );
  }

  /**
   * Log a debug message
   *
   * @param {string} message - The debug message
   * @param {LogData} [data] - Optional data to include
   */
  debug(message: string, data?: LogData): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const formattedData = this.formatMessage('debug', message, data);
    console.debug(
      this.colorize(this.levelColors.debug!, this.formatLogLevel('debug')) +
        ' ' +
        this.formatOutput(formattedData),
    );
  }

  /**
   * Log a trace message (most verbose level)
   *
   * @param {string} message - The trace message
   * @param {LogData} [data] - Optional data to include
   */
  trace(message: string, data?: LogData): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;
    const formattedData = this.formatMessage('trace', message, data);
    console.debug(
      this.colorize(this.levelColors.trace!, this.formatLogLevel('trace')) +
        ' ' +
        this.formatOutput(formattedData),
    );
  }

  /**
   * Log an action message (for server actions or important user interactions)
   *
   * @param {string} message - The action message
   * @param {LogData} [data] - Optional data to include
   */
  action(message: string, data?: LogData): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const formattedData = this.formatMessage('action', message, data);
    console.log(
      this.colorize(this.levelColors.action!, this.formatLogLevel('action')) +
        ' ' +
        this.formatOutput(formattedData),
    );
  }

  /**
   * Log a success message
   *
   * @param {string} message - The success message
   * @param {LogData} [data] - Optional data to include
   */
  success(message: string, data?: LogData): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const formattedData = this.formatMessage('success', message, data);
    console.log(
      this.colorize(this.levelColors.success!, this.formatLogLevel('success')) +
        ' ' +
        this.formatOutput(formattedData),
    );
  }

  /**
   * Group related log messages (Console.group wrapper)
   *
   * @param {string} label - The group label
   */
  group(label: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.group({ label: this.colorize('bold', label) });
  }

  /**
   * End a log group (Console.groupEnd wrapper)
   */
  groupEnd(): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.groupEnd();
  }

  /**
   * Log execution time of a function
   *
   * @template T - The return type of the function being timed
   * @param {string} label - Description of the operation being timed
   * @param {() => Promise<T> | T} fn - Function to execute and time
   * @returns {Promise<T>} The result of the function execution
   */
  async time<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
    if (!this.shouldLog(LogLevel.DEBUG)) return fn();

    const startTime = performance.now();
    try {
      const result = await fn();
      const endTime = performance.now();
      this.info(`${label} completed in ${(endTime - startTime).toFixed(2)}ms`);
      return result;
    } catch (error) {
      const endTime = performance.now();
      this.error(`${label} failed after ${(endTime - startTime).toFixed(2)}ms`, error);
      throw error;
    }
  }
}

export const logger = new Logger('[LOGGER]', {
  includeTimestamp: true,
  colorize: true,
});

// Usage examples:
/*
// Basic usage
const logger = new Logger("UserService");
logger.info("User logged in", { userId: "123" });

// With options
const detailedLogger = new Logger("AuthService", { 
  minLevel: LogLevel.DEBUG,
  includeTimestamp: true,
  colorize: true
});

// Singleton pattern
const logger1 = Logger.getLogger("ApiClient");
const logger2 = Logger.getLogger("ApiClient"); // Returns the same instance

// Set global log level
Logger.setGlobalLogLevel(LogLevel.WARN); // Only show warnings and errors

// Time operations
async function fetchData() {
  return await logger.time("API Request", async () => {
    const response = await fetch("https://api.example.com/data");
    return response.json();
  });
}
*/
