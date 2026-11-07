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
 * @file The shared status wording, which the home status tile and the footer badge both use:
 * every state has short sentence-case words and a tone, an answer that counted no active monitor
 * says 'Monitoring paused' (Better Stack calls it 'operational' while nothing is watched), a count
 * appears only when some monitor is not up (never '4/4' or '0/0'), and an old answer is 'Last
 * known: ...'.
 */

import { describe, expect, it } from 'vitest';

import {
  CHECKING_STATUS,
  isLastKnownAnswer,
  LAST_KNOWN_PREFIX,
  monitorsLine,
  SERVICE_STATE_COPY,
  type ServiceStateKey,
  serviceCopyKey,
  serviceStatusWords,
  statusSentence,
} from '@/lib/status/service-state';

// Before any answer the check is still running: that is no failure, so it is not 'unavailable'.
describe('CHECKING_STATUS', () => {
  it("says the check is running ('Checking status…'), never a state's words", () => {
    expect(CHECKING_STATUS).toBe('Checking status…');
    const labels = Object.values(SERVICE_STATE_COPY).map((copy) => copy.label);
    expect(labels).not.toContain(CHECKING_STATUS);
  });
});

// One rule for the tile and the footer badge, so they never word the same answer differently.
describe('isLastKnownAnswer', () => {
  it.each([
    ['operational', undefined, false, false],
    ['operational', false, false, false],
    ['operational', true, false, true],
    ['operational', undefined, true, true],
    ['degraded', true, true, true],
    ['down', undefined, true, true],
    ['unknown', true, false, false],
    ['unknown', undefined, true, false],
  ] as const)('%s, stale %s, poll failed %s: %s', (state, stale, pollFailed, lastKnown) => {
    expect(isLastKnownAnswer(state, stale, pollFailed)).toBe(lastKnown);
  });
});

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

  // The slim status tile has one line; 'Degraded performance' and 'Service outage' were cut down.
  it('words each state short, in sentence case', () => {
    expect(
      Object.fromEntries(
        Object.entries(SERVICE_STATE_COPY).map(([key, copy]) => [key, copy.label]),
      ),
    ).toEqual({
      operational: 'All systems up',
      degraded: 'Degraded',
      down: 'Outage',
      unknown: 'Status unavailable',
      paused: 'Monitoring paused',
    });
  });
});

describe('monitorsLine', () => {
  it.each([
    [{ up: 5, total: 6 }, '5/6 up'],
    [{ up: 0, total: 2 }, '0/2 up'],
    // All up: the state already says so ('4/4 monitors up' was cut).
    [{ up: 6, total: 6 }, undefined],
    [{ up: 0, total: 0 }, undefined],
    [undefined, undefined],
  ])('%o reads %s', (monitors, line) => {
    expect(monitorsLine(monitors)).toBe(line);
  });
});

describe('serviceStatusWords', () => {
  it.each([
    ['operational', { up: 4, total: 4 }, { label: 'All systems up', tone: 'live' }],
    ['degraded', { up: 3, total: 4 }, { label: 'Degraded', count: '3/4 up', tone: 'ongoing' }],
    ['down', { up: 2, total: 4 }, { label: 'Outage', count: '2/4 up', tone: 'down' }],
    ['degraded', { up: 4, total: 4 }, { label: 'Degraded', tone: 'ongoing' }],
    ['operational', { up: 0, total: 0 }, { label: 'Monitoring paused', tone: 'idle' }],
    ['unknown', undefined, { label: 'Status unavailable', tone: 'idle' }],
    ['unknown', { up: 2, total: 4 }, { label: 'Status unavailable', tone: 'idle' }],
  ] as const)('words %s with %o', (state: ServiceStateKey, monitors, words) => {
    expect(serviceStatusWords(state, monitors, false)).toEqual(words);
  });

  it("marks an old answer 'Last known', but never an unknown one", () => {
    expect(serviceStatusWords('down', { up: 2, total: 4 }, true)).toEqual({
      label: `${LAST_KNOWN_PREFIX}Outage`,
      count: '2/4 up',
      tone: 'down',
    });
    expect(serviceStatusWords('unknown', undefined, true).label).toBe('Status unavailable');
    expect(serviceStatusWords('unknown', { up: 2, total: 4 }, true)).toEqual({
      label: 'Status unavailable',
      tone: 'idle',
    });
  });
});

describe('statusSentence', () => {
  it('joins the count after the words with a no-break space before the dot', () => {
    expect(statusSentence({ label: 'Degraded', count: '3/4 up', tone: 'ongoing' })).toBe(
      'Degraded · 3/4 up',
    );
    expect(statusSentence({ label: 'All systems up', tone: 'live' })).toBe('All systems up');
  });
});
