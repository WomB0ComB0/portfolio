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

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bind,
  Capitalize,
  catchError,
  debounce,
  failure,
  getURL,
  IsArrayEmpty,
  IsObjectEmpty,
  IsString,
  IsStringEmpty,
  map,
  memoize,
  railway,
  recover,
  ScrollIntoCenterView,
  Stringify,
  slugify,
  success,
  tap,
  truncate,
} from './helpers';

describe('Stringify', () => {
  it('should stringify an object with 2-space indentation', () => {
    const obj = { name: 'John', age: 30 };
    const expected = JSON.stringify(obj, null, 2);
    expect(Stringify(obj)).toBe(expected);
  });
});

describe('Result', () => {
  it('should create a success result', () => {
    const s = success(42);
    expect(s.success).toBe(true);
    if (s.success) {
      expect(s.value).toBe(42);
    }
  });

  it('should create a failure result', () => {
    const f = failure('error');
    expect(f.success).toBe(false);
    if (!f.success) {
      expect(f.error).toBe('error');
    }
  });
});

describe('catchError', () => {
  it('should return a success result when the async function resolves', async () => {
    const asyncFn = async (a: number, b: number) => a + b;
    const result = await catchError(asyncFn, 2, 3);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(5);
    }
  });

  it('should return a failure result when the async function rejects', async () => {
    const error = new Error('test error');
    const asyncFn = async () => {
      throw error;
    };
    const result = await catchError(asyncFn);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(error);
    }
  });
});

describe('map', () => {
  it('should apply the function to a success value', () => {
    const s = success(5);
    const mapped = map((x: number) => x * 2)(s);
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.value).toBe(10);
    }
  });

  it('should not apply the function to a failure value', () => {
    const f = failure('error');
    const mapped = map((x: number) => x * 2)(f);
    expect(mapped.success).toBe(false);
  });
});

describe('bind', () => {
  it('should chain a function that returns a result', () => {
    const s = success(5);
    const bound = bind((x: number) => success(x * 2))(s);
    expect(bound.success).toBe(true);
    if (bound.success) {
      expect(bound.value).toBe(10);
    }
  });
});

describe('railway', () => {
  it('should apply a series of functions and return the final result', () => {
    const double = (x: number) => success(x * 2);
    const add_one = (x: number) => success(x + 1);
    const result = railway(5, double, add_one);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(11);
    }
  });

  it('should short-circuit on the first failure', () => {
    const double = (x: number) => success(x * 2);
    const fail = (_: number) => failure('error');
    const add_one = (x: number) => success(x + 1);
    const result = railway(5, double, fail, add_one);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('error');
    }
  });
});

describe('recover', () => {
  it('should recover from a failure', () => {
    const f = failure('error');
    const recovered = recover((e: string) => success(`recovered from ${e}`))(f);
    expect(recovered.success).toBe(true);
    if (recovered.success) {
      expect(recovered.value).toBe('recovered from error');
    }
  });
});

describe('tap', () => {
  it('should perform a side effect on a success value', () => {
    const s = success(5);
    const fn = vi.fn();
    tap(fn)(s);
    expect(fn).toHaveBeenCalledWith(5);
  });
});

describe('getURL', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should return localhost URL when no env variables are set', () => {
    expect(getURL('/test')).toBe('http://localhost:3000/test');
  });

  it('should prioritize NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.NEXT_PUBLIC_VERCEL_URL = 'https://vercel.app';
    expect(getURL('/test')).toBe('https://example.com/test');
  });

  it('should fall back to NEXT_PUBLIC_VERCEL_URL', () => {
    process.env.NEXT_PUBLIC_VERCEL_URL = 'https://vercel.app';
    expect(getURL('/test')).toBe('https://vercel.app/test');
  });
});

describe('ScrollIntoCenterView', () => {
  it('should call window.scrollTo with the correct parameters', () => {
    const mockElement = {
      getBoundingClientRect: () => ({ top: 100, height: 50 }),
    } as Element;
    document.querySelector = vi.fn(() => mockElement);
    window.scrollTo = vi.fn();

    ScrollIntoCenterView('#test');

    expect(window.scrollTo).toHaveBeenCalled();
  });
});

describe('slugify', () => {
  it('should convert a string to a URL-friendly slug', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
  });
});

describe('debounce', () => {
  it('should debounce a function', () => {
    vi.useFakeTimers();
    const func = vi.fn();
    const debouncedFunc = debounce(func, 500);

    for (let i = 0; i < 5; i++) {
      debouncedFunc();
    }

    vi.runAllTimers();
    expect(func).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('Capitalize', () => {
  it('should capitalize the first letter of a string', () => {
    expect(Capitalize('hello')).toBe('Hello');
  });
});

describe('IsObjectEmpty', () => {
  it('should return true for an empty object', () => {
    expect(IsObjectEmpty({})).toBe(true);
  });
  it('should return false for a non-empty object', () => {
    expect(IsObjectEmpty({ a: 1 })).toBe(false);
  });
});

describe('IsArrayEmpty', () => {
  it('should return true for an empty array', () => {
    expect(IsArrayEmpty([])).toBe(true);
  });
  it('should return false for a non-empty array', () => {
    expect(IsArrayEmpty([1])).toBe(false);
  });
});

describe('IsStringEmpty', () => {
  it('should return true for an empty string', () => {
    expect(IsStringEmpty('')).toBe(true);
  });
  it('should return true for a string with only whitespace', () => {
    expect(IsStringEmpty('   ')).toBe(true);
  });
  it('should return false for a non-empty string', () => {
    expect(IsStringEmpty('hello')).toBe(false);
  });
});

describe('IsString', () => {
  it('should return true for a string', () => {
    expect(IsString('hello')).toBe(true);
  });
  it('should return false for a non-string', () => {
    expect(IsString(123)).toBe(false);
  });
});

describe('memoize', () => {
  it('should memoize a function', () => {
    const func = vi.fn((a: number, b: number) => a + b);
    const memoizedFunc = memoize(func);

    memoizedFunc(1, 2);
    memoizedFunc(1, 2);

    expect(func).toHaveBeenCalledTimes(1);
  });
});

describe('truncate', () => {
  it('should truncate a string and add an ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });
  it('should not truncate a string if it is shorter than the length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
});
