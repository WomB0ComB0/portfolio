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
 * @file When the weekly sweep lifts an automated block or quarantine, as pure functions in the
 * style of link-health/state.ts. A flag is lifted after LIFT_AFTER_CLEAN_RUNS runs in a row that
 * checked it and found it clean, and only ever by a clean run: a run that could not check it counts
 * for nothing (a stored count already at the threshold is read as one short, never as a lift), a
 * new hit resets the count, and a flag whose host or link has left the upstream catalog is dropped.
 * The owner's committed pins are always kept and never counted. Two runs, because one clean answer
 * from a provider is weak evidence. Only the counts are stored, as the drift state's cleanStreaks.
 * sweep.ts settles blocked hosts and quarantined links with it; guarded by
 * tests/unit/free-books/flag-policy.test.ts.
 */

/** Clean runs in a row that lift a flag. */
export const LIFT_AFTER_CLEAN_RUNS = 2;

/** What one run saw for a key: flagged (again), checked and clean, or not checked at all. */
export type FlagObservation = 'flagged' | 'clean' | 'unchecked';

export interface FlagSettlementInput {
  /** The flags in hand: the baseline's, with this run's new hits and reasons written over them. */
  readonly flags: Readonly<Record<string, string>>;
  /** What this run saw for each key; a key it did not see counts as unchecked. */
  readonly observations: ReadonlyMap<string, FlagObservation>;
  /** The stored clean-run counts, as read back (each is read with readCleanStreak). */
  readonly streaks: Readonly<Record<string, unknown>>;
  /** The owner's committed pins: always kept with their own reason, never counted. */
  readonly pins: Readonly<Record<string, string>>;
  /** The keys (hosts or links) still in the upstream catalog. */
  readonly inCatalog: ReadonlySet<string>;
}

export interface FlagSettlement {
  /** The flags that stand after this run. */
  readonly flags: Record<string, string>;
  /** The clean-run count of each standing flag that has one (a count of 0 is left out). */
  readonly streaks: Record<string, number>;
}

/** A stored clean-run count; anything but a whole number of 0 or more reads as 0. */
export function readCleanStreak(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * A standing flag's stored count, at most one short of lifting: a count at or past
 * LIFT_AFTER_CLEAN_RUNS cannot belong to a flag that still stands, so it is read as one clean run
 * short. Only a clean observation can then lift the flag.
 */
function priorStreak(streaks: Readonly<Record<string, unknown>>, key: string): number {
  const stored = Object.hasOwn(streaks, key) ? readCleanStreak(streaks[key]) : 0;
  return Math.min(stored, LIFT_AFTER_CLEAN_RUNS - 1);
}

/**
 * The flags that stand after this run and their counts. Flagged keeps the new reason with no
 * count; clean adds one and lifts at LIFT_AFTER_CLEAN_RUNS; unchecked keeps the flag and its count,
 * and never lifts it, whatever count was stored.
 */
export function settleFlags({
  flags,
  observations,
  streaks,
  pins,
  inCatalog,
}: FlagSettlementInput): FlagSettlement {
  const standing = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const [key, reason] of Object.entries(flags)) {
    if (Object.hasOwn(pins, key) || !inCatalog.has(key)) continue;
    const observation = observations.get(key) ?? 'unchecked';
    if (observation === 'flagged') {
      standing.set(key, reason);
      continue;
    }
    const prior = priorStreak(streaks, key);
    const streak = observation === 'clean' ? prior + 1 : prior;
    if (observation === 'clean' && streak >= LIFT_AFTER_CLEAN_RUNS) continue;
    standing.set(key, reason);
    if (streak > 0) counts.set(key, streak);
  }
  for (const [key, reason] of Object.entries(pins)) {
    standing.set(key, reason);
  }
  return { flags: Object.fromEntries(standing), streaks: Object.fromEntries(counts) };
}
