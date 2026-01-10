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
 * @file Error Classes Unit Tests
 * @description Tests for custom error classes and error handling utilities.
 */

import { describe, expect, it } from 'vitest';
import { BaseError, ensureBaseError, isBaseError } from '../../../src/classes/error';

describe('Error Classes', () => {
  describe('BaseError', () => {
    it('creates error with cause and command', () => {
      const cause = new Error('Original error');
      const error = new BaseError(cause, 'test:command');

      expect(error.cause).toBe(cause);
      expect(error.command).toBe('test:command');
      expect(error.name).toBe('BaseError');
      expect(error._tag).toBe('BaseError');
    });

    it('includes metadata when provided', () => {
      const cause = new Error('Test error');
      const metadata = { userId: '123', action: 'test' };
      const error = new BaseError(cause, 'test:command', metadata);

      expect(error.metadata).toEqual(metadata);
    });

    it('records timestamp', () => {
      const before = Date.now();
      const error = new BaseError(new Error('Test'), 'test:command');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('handles empty metadata gracefully', () => {
      const error = new BaseError(new Error('Test'), 'test:command');

      expect(error.metadata).toEqual({});
    });

    it('is an instance of Error', () => {
      const error = new BaseError(new Error('Test'), 'test:command');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof BaseError).toBe(true);
    });

    it('toString formats error correctly', () => {
      const cause = new Error('Connection refused');
      const error = new BaseError(cause, 'database:connect');

      const str = error.toString();
      expect(str).toContain('BaseError');
      expect(str).toContain('Connection refused');
      expect(str).toContain('database:connect');
    });

    it('toJSON serializes error correctly', () => {
      const cause = new Error('Test error');
      const metadata = { key: 'value' };
      const error = new BaseError(cause, 'test:command', metadata);

      const json = error.toJSON();

      expect(json.name).toBe('BaseError');
      expect(json.message).toBe('Test error');
      expect(json.command).toBe('test:command');
      expect(json.metadata).toEqual(metadata);
      expect(json.cause.message).toBe('Test error');
      expect(typeof json.timestamp).toBe('number');
    });
  });

  describe('isBaseError', () => {
    it('returns true for BaseError instances', () => {
      const error = new BaseError(new Error('Test'), 'test:command');

      expect(isBaseError(error)).toBe(true);
    });

    it('returns false for standard Error', () => {
      const error = new Error('Standard error');

      expect(isBaseError(error)).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isBaseError(null)).toBe(false);
      expect(isBaseError(undefined)).toBe(false);
      expect(isBaseError('string')).toBe(false);
      expect(isBaseError(123)).toBe(false);
      expect(isBaseError({})).toBe(false);
    });

    it('returns false for objects that look like BaseError but are not', () => {
      const fakeError = {
        cause: new Error('Fake'),
        command: 'fake:command',
        _tag: 'BaseError',
      };

      expect(isBaseError(fakeError)).toBe(false);
    });
  });

  describe('ensureBaseError', () => {
    it('returns BaseError as-is', () => {
      const original = new BaseError(new Error('Original'), 'original:command');
      const result = ensureBaseError(original, 'new:command');

      expect(result).toBe(original);
      expect(result.command).toBe('original:command');
    });

    it('wraps standard Error in BaseError', () => {
      const original = new Error('Standard error');
      const result = ensureBaseError(original, 'wrapped:command');

      expect(isBaseError(result)).toBe(true);
      expect(result.cause).toBe(original);
      expect(result.command).toBe('wrapped:command');
    });

    it('converts string to BaseError', () => {
      const result = ensureBaseError('String error', 'string:command');

      expect(isBaseError(result)).toBe(true);
      expect(result.cause.message).toBe('String error');
      expect(result.command).toBe('string:command');
    });

    it('handles null error', () => {
      const result = ensureBaseError(null, 'null:command');

      expect(isBaseError(result)).toBe(true);
      expect(result.command).toBe('null:command');
    });

    it('handles undefined error', () => {
      const result = ensureBaseError(undefined, 'undefined:command');

      expect(isBaseError(result)).toBe(true);
      expect(result.command).toBe('undefined:command');
    });

    it('includes additional metadata', () => {
      const original = new Error('Test');
      const metadata = { key: 'value', count: 42 };
      const result = ensureBaseError(original, 'meta:command', metadata);

      expect(result.metadata).toEqual(metadata);
    });

    it('preserves original error as cause', () => {
      const original = new Error('Original cause');
      const result = ensureBaseError(original, 'cause:command');

      expect(result.cause).toBe(original);
      expect(result.cause.message).toBe('Original cause');
    });

    it('handles objects with toString', () => {
      const obj = { toString: () => 'Custom error message' };
      const result = ensureBaseError(obj, 'object:command');

      expect(isBaseError(result)).toBe(true);
      expect(result.cause.message).toBe('Custom error message');
    });

    it('handles numbers', () => {
      const result = ensureBaseError(404, 'number:command');

      expect(isBaseError(result)).toBe(true);
      expect(result.cause.message).toBe('404');
    });
  });
});

describe('Error Serialization', () => {
  it('BaseError can be JSON stringified', () => {
    const cause = new Error('Test error');
    const error = new BaseError(cause, 'test:command', { data: 'value' });
    const json = error.toJSON();

    // Verify the JSON structure
    expect(json.message).toBe('Test error');
    expect(json.command).toBe('test:command');
    expect(json.metadata).toEqual({ data: 'value' });
  });

  it('error metadata is preserved in serialization', () => {
    const metadata = { userId: '123', timestamp: 1704067200000 };
    const error = new BaseError(new Error('Test'), 'test:command', metadata);
    const json = error.toJSON();

    expect(json.metadata).toEqual(metadata);
  });

  it('cause error details are preserved', () => {
    const cause = new Error('Detailed cause');
    const error = new BaseError(cause, 'test:command');
    const json = error.toJSON();

    expect(json.cause.name).toBe('Error');
    expect(json.cause.message).toBe('Detailed cause');
    expect(json.cause.stack).toBeDefined();
  });
});
