import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel } from './logger';

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
});
