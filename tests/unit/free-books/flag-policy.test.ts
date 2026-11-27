// @vitest-environment node

/**
 * Copyright 2026 Mike Odnis
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
 * @file src/lib/free-books/flag-policy.ts as a table: what each observation does to a flag and its
 * clean-run count, how pins and links that left the catalog are treated, and how a stored count
 * is read back. The weekly behaviour end to end is in sweep.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { type FlagObservation, readCleanStreak, settleFlags } from '@/lib/free-books/flag-policy';

describe('settleFlags', () => {
  const REASON = 'parked_domain';
  it.each<{
    readonly name: string;
    readonly flag?: string;
    readonly observation?: FlagObservation;
    readonly streak?: unknown;
    readonly pin?: string;
    readonly inCatalog?: boolean;
    readonly expected: { readonly flag?: string; readonly streak?: number };
  }>([
    {
      name: 'keeps a new flag with no count',
      flag: REASON,
      observation: 'flagged',
      expected: { flag: REASON },
    },
    {
      name: 'resets the count of a flag raised again',
      flag: 'clickfix_lure',
      observation: 'flagged',
      streak: 1,
      expected: { flag: 'clickfix_lure' },
    },
    {
      name: 'counts a first clean run and keeps the flag',
      flag: REASON,
      observation: 'clean',
      expected: { flag: REASON, streak: 1 },
    },
    {
      name: 'lifts a flag on its second clean run in a row',
      flag: REASON,
      observation: 'clean',
      streak: 1,
      expected: {},
    },
    { name: 'leaves an unflagged clean key alone', observation: 'clean', expected: {} },
    {
      name: 'keeps an unchecked flag and its count',
      flag: REASON,
      observation: 'unchecked',
      streak: 1,
      expected: { flag: REASON, streak: 1 },
    },
    {
      name: 'treats an unseen key as unchecked',
      flag: REASON,
      streak: 1,
      expected: { flag: REASON, streak: 1 },
    },
    {
      name: 'never lifts an unchecked flag whose stored count is already at the threshold',
      flag: REASON,
      observation: 'unchecked',
      streak: 2,
      expected: { flag: REASON, streak: 1 },
    },
    {
      name: 'never lifts an unseen flag whose stored count is past the threshold',
      flag: REASON,
      streak: 7,
      expected: { flag: REASON, streak: 1 },
    },
    {
      name: 'lifts a flag with a stored count past the threshold on its next clean run',
      flag: REASON,
      observation: 'clean',
      streak: 7,
      expected: {},
    },
    {
      name: 'resets a stored count past the threshold when the flag is raised again',
      flag: REASON,
      observation: 'flagged',
      streak: 2,
      expected: { flag: REASON },
    },
    {
      name: 'reads a malformed count as 0',
      flag: REASON,
      observation: 'clean',
      streak: '1',
      expected: { flag: REASON, streak: 1 },
    },
    {
      name: 'drops a flag whose key left the catalog',
      flag: REASON,
      observation: 'unchecked',
      streak: 1,
      inCatalog: false,
      expected: {},
    },
    {
      name: 'always keeps a pin, with its own reason and no count',
      flag: REASON,
      observation: 'clean',
      streak: 1,
      pin: 'Manual block',
      expected: { flag: 'Manual block' },
    },
    {
      name: 'keeps a pin even after its key left the catalog',
      pin: 'Manual block',
      inCatalog: false,
      expected: { flag: 'Manual block' },
    },
  ])('$name', ({ flag, observation, streak, pin, inCatalog = true, expected }) => {
    const key = 'https://indie.example/guide';

    const settled = settleFlags({
      flags: flag === undefined ? {} : { [key]: flag },
      observations: new Map(observation === undefined ? [] : [[key, observation]]),
      streaks: streak === undefined ? {} : { [key]: streak },
      pins: pin === undefined ? {} : { [key]: pin },
      inCatalog: new Set(inCatalog ? [key] : []),
    });

    expect(settled.flags).toEqual(expected.flag === undefined ? {} : { [key]: expected.flag });
    expect(settled.streaks).toEqual(
      expected.streak === undefined ? {} : { [key]: expected.streak },
    );
  });

  it.each([
    [0, 0],
    [1, 1],
    [7, 7],
    [-1, 0],
    [1.5, 0],
    ['2', 0],
    [null, 0],
    [undefined, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('readCleanStreak(%s) is %s', (value, expected) => {
    expect(readCleanStreak(value)).toBe(expected);
  });
});
