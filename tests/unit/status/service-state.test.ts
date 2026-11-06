// @vitest-environment node
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
 * @file The shared status wording: every state has words and a tone, an answer that counted no
 * active monitor says 'Monitoring paused' (Better Stack calls it 'operational' while nothing is
 * watched), and the monitor line never prints a count it was not given.
 */

import { describe, expect, it } from 'vitest';

import {
  monitorsLine,
  SERVICE_STATE_COPY,
  type ServiceStateKey,
  serviceCopyKey,
} from '@/lib/status/service-state';

describe('serviceCopyKey', () => {
  it.each([
    ['operational', { up: 0, total: 0 }, 'paused'],
    ['degraded', { up: 0, total: 0 }, 'paused'],
    ['operational', { up: 4, total: 4 }, 'operational'],
    ['down', { up: 3, total: 4 }, 'down'],
    ['operational', undefined, 'operational'],
    ['unknown', undefined, 'unknown'],
    ['unknown', { up: 0, total: 0 }, 'unknown'],
  ] as const)('%s with %o is %s', (state: ServiceStateKey, monitors, key) => {
    expect(serviceCopyKey(state, monitors)).toBe(key);
  });
});

describe('SERVICE_STATE_COPY', () => {
  it("says 'Monitoring paused' in the idle tone, never 'up'", () => {
    expect(SERVICE_STATE_COPY.paused).toEqual({ label: 'Monitoring paused', tone: 'idle' });
    expect(SERVICE_STATE_COPY.paused.label).not.toMatch(/up\b/);
  });

  it('gives every state its own words', () => {
    const labels = Object.values(SERVICE_STATE_COPY).map((copy) => copy.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('monitorsLine', () => {
  it.each([
    [{ up: 6, total: 6 }, '6/6 monitors up'],
    [{ up: 5, total: 6 }, '5/6 monitors up'],
    [{ up: 0, total: 0 }, undefined],
    [undefined, undefined],
  ])('%o reads %s', (monitors, line) => {
    expect(monitorsLine(monitors)).toBe(line);
  });
});
