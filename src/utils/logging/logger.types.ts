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
