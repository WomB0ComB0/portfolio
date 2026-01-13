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
 * @fileoverview TypeScript decorators for logging method calls, timing, and errors.
 * These decorators integrate with the Logger class to provide declarative logging.
 */

import { Logger } from './logger';
import type {
  LogClassOptions,
  LogErrorOptions,
  LogMethodOptions,
  LogTimingOptions,
} from './logger.types';

/**
 * Decorator that logs method entry and exit.
 * Can optionally log arguments and return values.
 *
 * @param {LogMethodOptions} [options={}] - Configuration options
 * @returns {MethodDecorator} The decorator function
 *
 * @example
 * ```typescript
 * class UserService {
 *   @Log({ logArgs: true, logResult: true })
 *   async getUser(id: string) {
 *     return { id, name: 'John' };
 *   }
 * }
 * ```
 */
export function Log(options: LogMethodOptions = {}): MethodDecorator {
  const { logArgs = true, logResult = false, message, level = 'debug' } = options;

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const className = target.constructor.name;

    descriptor.value = function (...args: unknown[]) {
      const logger = Logger.getLogger(`[${className}]`);
      const prefix = message || `${methodName}`;

      // Log method entry
      if (logArgs && args.length > 0) {
        logger[level](`${prefix} called`, { arguments: args });
      } else {
        logger[level](`${prefix} called`);
      }

      // Execute the original method
      const result = originalMethod.apply(this, args);

      // Handle async methods
      if (result instanceof Promise) {
        return result.then(
          (value: unknown) => {
            if (logResult) {
              logger[level](`${prefix} returned`, { result: value });
            } else {
              logger[level](`${prefix} completed`);
            }
            return value;
          },
          (error: unknown) => {
            logger.error(`${prefix} failed`, error);
            throw error;
          },
        );
      }

      // Log sync method result
      if (logResult) {
        logger[level](`${prefix} returned`, { result });
      } else {
        logger[level](`${prefix} completed`);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator that logs method execution time.
 * Useful for performance monitoring.
 *
 * @param {LogTimingOptions} [options={}] - Configuration options
 * @returns {MethodDecorator} The decorator function
 *
 * @example
 * ```typescript
 * class DataService {
 *   @LogTiming({ threshold: 100 }) // Only log if execution > 100ms
 *   async fetchData() {
 *     // ... slow operation
 *   }
 * }
 * ```
 */
export function LogTiming(options: LogTimingOptions = {}): MethodDecorator {
  const { label, threshold = 0, level = 'info' } = options;

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const className = target.constructor.name;

    descriptor.value = function (...args: unknown[]) {
      const logger = Logger.getLogger(`[${className}]`);
      const timerLabel = label || `${className}.${methodName}`;
      const startTime = performance.now();

      // Execute the original method
      const result = originalMethod.apply(this, args);

      // Handle async methods
      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - startTime;
          if (duration >= threshold) {
            logger[level](`${timerLabel} completed in ${duration.toFixed(2)}ms`);
          }
        });
      }

      // Log sync method timing
      const duration = performance.now() - startTime;
      if (duration >= threshold) {
        logger[level](`${timerLabel} completed in ${duration.toFixed(2)}ms`);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator that wraps method in try/catch and logs errors.
 * Can optionally suppress the error or rethrow it.
 *
 * @param {LogErrorOptions} [options={}] - Configuration options
 * @returns {MethodDecorator} The decorator function
 *
 * @example
 * ```typescript
 * class ApiService {
 *   @LogError({ rethrow: false, message: 'API call failed' })
 *   async callApi() {
 *     throw new Error('Network error');
 *   }
 * }
 * ```
 */
export function LogError(options: LogErrorOptions = {}): MethodDecorator {
  const { rethrow = true, message, includeStack = true } = options;

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const className = target.constructor.name;

    descriptor.value = function (...args: unknown[]) {
      const logger = Logger.getLogger(`[${className}]`);
      const errorPrefix = message || `${methodName} error`;

      try {
        const result = originalMethod.apply(this, args);

        // Handle async methods
        if (result instanceof Promise) {
          return result.catch((error: unknown) => {
            const errorData: Record<string, unknown> = { method: methodName };
            if (error instanceof Error && includeStack) {
              errorData.stack = error.stack;
            }
            logger.error(errorPrefix, error, errorData);
            if (rethrow) throw error;
            return undefined;
          });
        }

        return result;
      } catch (error) {
        const errorData: Record<string, unknown> = { method: methodName };
        if (error instanceof Error && includeStack) {
          errorData.stack = error.stack;
        }
        logger.error(errorPrefix, error, errorData);
        if (rethrow) throw error;
        return undefined;
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator that applies logging to all methods of a class.
 * Can be configured to exclude specific methods.
 *
 * @param {LogClassOptions} [options={}] - Configuration options
 * @returns {ClassDecorator} The decorator function
 *
 * @example
 * ```typescript
 * @LogClass({ exclude: ['privateMethod'], timing: true })
 * class MyService {
 *   publicMethod() { ... }
 *   privateMethod() { ... } // Won't be logged
 * }
 * ```
 */
export function LogClass(
  options: LogClassOptions = {},
): <T extends new (...args: unknown[]) => object>(target: T) => T {
  const { exclude = [], logCalls = true, timing = false } = options;

  return <T extends new (...args: unknown[]) => object>(target: T): T => {
    const className = target.name;
    const prototype = target.prototype;

    // Only apply decorators if prototype exists
    if (prototype) {
      // Get all method names from the prototype
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) =>
          name !== 'constructor' &&
          typeof prototype[name] === 'function' &&
          !exclude.includes(name),
      );

      // Apply decorators to each method
      for (const methodName of methodNames) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
        if (!descriptor) continue;

        const originalMethod = descriptor.value;

        descriptor.value = function (...args: unknown[]) {
          const logger = Logger.getLogger(`[${className}]`);
          const startTime = timing ? performance.now() : 0;

          if (logCalls) {
            logger.debug(`${methodName} called`, { arguments: args });
          }

          const result = originalMethod.apply(this, args);

          if (result instanceof Promise) {
            return result.then(
              (value: unknown) => {
                if (timing) {
                  const duration = performance.now() - startTime;
                  logger.debug(`${methodName} completed in ${duration.toFixed(2)}ms`);
                } else if (logCalls) {
                  logger.debug(`${methodName} completed`);
                }
                return value;
              },
              (error: unknown) => {
                logger.error(`${methodName} failed`, error);
                throw error;
              },
            );
          }

          if (timing) {
            const duration = performance.now() - startTime;
            logger.debug(`${methodName} completed in ${duration.toFixed(2)}ms`);
          } else if (logCalls) {
            logger.debug(`${methodName} completed`);
          }

          return result;
        };

        Object.defineProperty(prototype, methodName, descriptor);
      }
    }

    return target;
  };
}
