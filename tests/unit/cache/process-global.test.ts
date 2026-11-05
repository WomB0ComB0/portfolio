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

// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const NAME = 'test.process-global';

afterEach(async () => {
  const { resetProcessGlobal } = await import('@/lib/cache/process-global');
  resetProcessGlobal(NAME);
});

describe('processGlobal', () => {
  it('gives two separately loaded copies of the module the same value', async () => {
    const first = await import('@/lib/cache/process-global');
    vi.resetModules();
    const second = await import('@/lib/cache/process-global');
    expect(second).not.toBe(first);

    const a = first.processGlobal(NAME, () => ({ cache: null as string | null }));
    a.cache = 'filled by the page';
    const b = second.processGlobal(NAME, () => ({ cache: null as string | null }));

    expect(b).toBe(a);
    expect(b.cache).toBe('filled by the page');
  });

  it('runs init once and builds a fresh value after a reset', async () => {
    const { processGlobal, resetProcessGlobal } = await import('@/lib/cache/process-global');
    const init = vi.fn(() => ({ n: 1 }));

    const a = processGlobal(NAME, init);
    processGlobal(NAME, init);
    expect(init).toHaveBeenCalledTimes(1);

    resetProcessGlobal(NAME);
    expect(processGlobal(NAME, init)).not.toBe(a);
    expect(init).toHaveBeenCalledTimes(2);
  });
});
