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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Log } from '@/utils/logging/logger.decorators';
import { Logger, LogLevel } from '../../../src/utils/logging/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.stubGlobal('process', { ...process, env: { ...process.env, NODE_ENV: 'development' } });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should create a logger instance', () => {
    const logger = new Logger('test');
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log an info message', () => {
    const logger = new Logger('test', { minLevel: LogLevel.INFO });
    logger.info('test message');
    expect(console.log).toHaveBeenCalled();
  });

  it('should not log an info message if the level is too low', () => {
    const logger = new Logger('test', { minLevel: LogLevel.ERROR });
    logger.info('test message');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should log an error message', () => {
    const logger = new Logger('test', { minLevel: LogLevel.ERROR });
    logger.error('test message');
    expect(console.error).toHaveBeenCalled();
  });

  it('should log a warning message', () => {
    const logger = new Logger('test', { minLevel: LogLevel.WARN });
    logger.warn('test message');
    expect(console.warn).toHaveBeenCalled();
  });

  it('should log a debug message', () => {
    const logger = new Logger('test', { minLevel: LogLevel.DEBUG });
    logger.debug('test message');
    expect(console.debug).toHaveBeenCalled();
  });

  it('should get a logger instance with getLogger', () => {
    const logger1 = Logger.getLogger('test');
    const logger2 = Logger.getLogger('test');
    expect(logger1).toBe(logger2);
  });

  it('should set the global log level', () => {
    const logger = Logger.getLogger('global-test', { minLevel: LogLevel.INFO });
    Logger.setGlobalLogLevel(LogLevel.ERROR);
    logger.info('test message');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should time a function', async () => {
    const logger = new Logger('timer-test', { minLevel: LogLevel.DEBUG });
    const fn = vi.fn(() => Promise.resolve('result'));
    const result = await logger.time('test operation', fn);
    expect(fn).toHaveBeenCalled();
    expect(result).toBe('result');
    expect(console.log).toHaveBeenCalled();
  });
  it.each(['trace', 'action', 'success'] as const)(
    'supports the decorator-selected %s method',
    (level) => {
      class Example {
        work(): number {
          return 7;
        }
      }
      const descriptor = Object.getOwnPropertyDescriptor(Example.prototype, 'work');
      if (!descriptor) throw new Error('Missing fixture method');
      Logger.getLogger('[Example]', { minLevel: LogLevel.TRACE });
      Logger.setGlobalLogLevel(LogLevel.TRACE);
      Log({ level, logArgs: false, logResult: true })(Example.prototype, 'work', descriptor);
      Object.defineProperty(Example.prototype, 'work', descriptor);
      expect(new Example().work()).toBe(7);
      const output = level === 'trace' ? console.debug : console.log;
      expect(output).toHaveBeenCalledTimes(2);
      expect(output).toHaveBeenLastCalledWith(expect.stringContaining('work returned'));
    },
  );

  it('supports NONE as an explicit logging-off option', () => {
    const logger = new Logger('silent', { minLevel: LogLevel.NONE });
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'action', 'success'] as const) {
      logger[level]('must stay silent');
    }
    for (const output of [console.log, console.error, console.warn, console.debug]) {
      expect(output).not.toHaveBeenCalled();
    }
  });
});
