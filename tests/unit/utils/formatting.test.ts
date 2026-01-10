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
 * @file String Formatting Utility Tests
 * @description Unit tests for string formatting utilities.
 */

import { describe, expect, it } from 'vitest';

// Example unit tests - replace with actual imports from your utils
describe('String Utilities', () => {
  describe('Stringify', () => {
    it('should format object as pretty JSON', () => {
      const obj = { name: 'John', age: 30 };
      const result = JSON.stringify(obj, null, 2);
      expect(result).toContain('"name": "John"');
      expect(result).toContain('"age": 30');
    });

    it('should handle nested objects', () => {
      const obj = { user: { name: 'John', address: { city: 'NYC' } } };
      const result = JSON.stringify(obj, null, 2);
      expect(result).toContain('user');
      expect(result).toContain('address');
      expect(result).toContain('city');
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3];
      const result = JSON.stringify(arr, null, 2);
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });
  });
});

describe('URL Utilities', () => {
  describe('getURL', () => {
    it('should return NEXT_PUBLIC_SITE_URL if set', () => {
      const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = 'https://test.example.com';

      const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      expect(url).toBe('https://test.example.com');

      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    });

    it('should fall back to localhost', () => {
      const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;

      const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      expect(url).toBe('http://localhost:3000');

      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    });
  });
});

describe('Result Pattern', () => {
  // Mock success/failure functions for testing
  const success = <T>(value: T) => ({ success: true as const, value });
  const failure = (error: string) => ({ success: false as const, error });

  describe('success', () => {
    it('should wrap value in success result', () => {
      const result = success(42);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should handle complex values', () => {
      const data = { id: 1, name: 'Test' };
      const result = success(data);
      expect(result.success).toBe(true);
      expect(result.value).toEqual(data);
    });
  });

  describe('failure', () => {
    it('should wrap error in failure result', () => {
      const result = failure('Something went wrong');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });
});
