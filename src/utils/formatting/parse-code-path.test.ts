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

import { describe, expect, it } from 'vitest';
import { parseCodePath, parseCodePathDetailed } from './parse-code-path';

describe('parseCodePath', () => {
  it('should format the code path correctly for a function', () => {
    function myFunction() {}
    const result = parseCodePath('test context', myFunction);
    expect(result).toContain('@myFunction: test context');
  });

  it('should handle anonymous functions', () => {
    const result = parseCodePath('test context', () => {});
    expect(result).toContain('@AnonymousFunction: test context');
  });

  it('should handle classes', () => {
    class MyClass {}
    const result = parseCodePath('test context', new MyClass());
    expect(result).toContain('@MyClass: test context');
  });
});

describe('parseCodePathDetailed', () => {
  it('should format the code path with detailed options', () => {
    function myFunction() {}
    const result = parseCodePathDetailed('test context', myFunction, {
      includeLineNumber: true,
      includeTimestamp: true,
      customPrefix: 'custom',
    });
    expect(result).toContain('custom:');
    expect(result).toContain('@myFunction: test context');
    expect(result).toMatch(/:(\d+):\d+/);
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
  });
});
