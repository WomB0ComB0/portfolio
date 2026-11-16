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
 * @file Which Discord presence the tile keeps, and how old it says it is, when this browser's
 * clock is off the server's and each answer says when the server served it (its Date plus Age;
 * for the page snapshot, the render's time). Reads are ordered by the server's clock, a read_at
 * later than the server's own time of serve counts as read at that time, and the age line is
 * carried into this browser's clock by each answer's own offset.
 *
 * Review F0 (round eleven): by a clock behind, reads were compared with a time on this browser's
 * clock, and an older cached copy put the tile back and forth (dnd, online, dnd, online, each
 * 'updated just now'). Answers here reach the browser 120 ms after they are served, and each
 * request left 120 ms before, by the monotonic clock (performance.now()) as well.
 *
 * Review F1 and verify P3 (round twelve): the time between two arrivals was measured with
 * Date.now(), so a step of the device clock between polls, or an answer that arrived seconds
 * after its Date, let an older copy replace the newer status for a poll. It is measured with the
 * monotonic clock now, from the request's start, and a presence kept over a step keeps its true
 * age on the stepped clock.
 */

import { describe, expect, it } from 'vitest';
import {
  type DatedPresence,
  presenceAfterPoll,
  snapshotPresence,
} from '@/app/(routes)/(dev)/stats/_lib/discord-presence';

const USER = { username: 'womb0.comb0', discriminator: '0', avatar: '', id: '42' };
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const POLL = 30 * SECOND;
/** The server's clock when it rendered the page (not on a whole second, as a Date never is). */
const RENDERED = Date.parse('2026-11-13T18:00:00.400Z');
/** How long an answer takes to reach the browser once served. */
const LATENCY = 120;

const SKEWS = [
  ['5 min behind', -5 * MINUTE],
  ['60 s behind', -MINUTE],
  ['in step', 0],
  ['60 s ahead', MINUTE],
  ['5 min ahead', 5 * MINUTE],
] as const;

/** A route answer: `status`, read at `readAt` (left out when undefined). */
const answer = (status: string, readAt?: number) => ({
  discord_status: status,
  discord_user: USER,
  activities: [],
  ...(readAt === undefined ? {} : { read_at: readAt }),
});

/** The response's Date for a moment: whole seconds, rounded down. */
const dateOf = (at: number) => Math.floor(at / SECOND) * SECOND;

/** performance.now() at a moment of real time: the page opened 10 s before the render. */
const mono = (at: number) => at - RENDERED + 10 * SECOND;

/** A request asked LATENCY before `servedAt` and answered LATENCY after, by the monotonic clock. */
const timesOf = (servedAt: number, answeredAfter = LATENCY) => ({
  sent: mono(servedAt - LATENCY),
  received: mono(servedAt + answeredAfter),
});

/**
 * One poll: the server serves `json` at `servedAt` (its clock, which here is real time) with a
 * Date header saying so, and it reaches a browser whose clock is `skew` off.
 */
const poll = (json: unknown, servedAt: number, skew: number, shown?: DatedPresence) =>
  presenceAfterPoll(json, servedAt + LATENCY + skew, shown, dateOf(servedAt), timesOf(servedAt));

/** The page snapshot, hydrated at real time `hydratedAt` by a browser whose clock is `skew` off. */
const seedAt = (fetchedAt: number, hydratedAt: number, skew: number) =>
  snapshotPresence(answer('online'), fetchedAt, hydratedAt + skew, RENDERED, mono(hydratedAt));

const statusOf = (dated: DatedPresence) => dated.presence.discord_status;
/** How old the age line says a presence is the moment it arrives. */
const ageOnArrival = (dated: DatedPresence) => dated.arrivedAt - dated.readAt;

describe.each(SKEWS)('the Discord presence by a browser clock %s', (_, skew) => {
  it('keeps the newer presence while the route alternates it with an older copy', () => {
    // Odd polls bring a read made 2 s before it was served; even polls an older cached copy,
    // read 30 s before that newest read.
    let shown: DatedPresence | undefined;
    let newest = 0;
    const seen: DatedPresence[] = [];
    for (let n = 1; n <= 6; n += 1) {
      const served = RENDERED + n * POLL;
      if (n % 2) newest = served - 2 * SECOND;
      const json = n % 2 ? answer('dnd', newest) : answer('idle', newest - 30 * SECOND);
      shown = poll(json, served, skew, shown);
      seen.push(shown);
    }
    expect(seen.map(statusOf)).toEqual(['dnd', 'dnd', 'dnd', 'dnd', 'dnd', 'dnd']);
    // Each newer read is aged from its own read: 2 s old when served, never 'minutes'.
    for (const dated of seen) {
      expect(ageOnArrival(dated)).toBeGreaterThan(0);
      expect(ageOnArrival(dated)).toBeLessThanOrEqual(2 * SECOND);
    }
  });

  it('keeps the snapshot when the first polls bring an older read', () => {
    const fetchedAt = RENDERED - 5 * SECOND;
    // The page hydrates 900 ms after the server rendered it.
    const seed = seedAt(fetchedAt, RENDERED + 900, skew);
    const older = answer('idle', fetchedAt - 30 * SECOND);
    expect(poll(older, RENDERED + POLL, skew, seed)).toBe(seed);
    expect(poll(older, RENDERED + 2 * POLL, skew, seed)).toBe(seed);
  });

  it('ages the snapshot by its age when the server rendered it, on this browser’s clock', () => {
    const hydratedAt = RENDERED + 900 + skew;
    const seed = seedAt(RENDERED - 50 * SECOND, RENDERED + 900, skew);
    expect(seed.readAt).toBe(hydratedAt - 50 * SECOND);
    expect(seed.arrivedAt).toBe(hydratedAt);
    expect(seed.statedAt).toBe(RENDERED - 50 * SECOND);
  });

  it('ages a read as old as it was when the server served it', () => {
    const served = dateOf(RENDERED) + POLL;
    const dated = poll(answer('dnd', served - 10 * MINUTE), served, skew);
    expect(ageOnArrival(dated)).toBe(10 * MINUTE);
    expect(dated.readAt).toBe(served + LATENCY + skew - 10 * MINUTE);
  });

  it('keeps counting from the same read while the route repeats it', () => {
    const read = RENDERED + POLL - 10 * SECOND;
    const first = poll(answer('dnd', read), RENDERED + POLL, skew);
    for (const n of [2, 3, 4]) {
      expect(poll(answer('dnd', read), RENDERED + n * POLL, skew, first)).toBe(first);
    }
  });

  it('reads a read_at later than the server served it as just now, and shows the answers after it', () => {
    const served = RENDERED + POLL;
    const ahead = poll(answer('dnd', served + 5 * MINUTE), served, skew);
    expect(ageOnArrival(ahead)).toBe(0);
    expect(ahead.statedAt).toBe(served + 5 * MINUTE);
    const next = poll(answer('idle', served + POLL - 2 * SECOND), served + POLL, skew, ahead);
    expect(statusOf(next)).toBe('idle');
    const after = poll(
      answer('dnd', served + 2 * POLL - 2 * SECOND),
      served + 2 * POLL,
      skew,
      next,
    );
    expect(statusOf(after)).toBe('dnd');
  });

  it('shows the honest answers after one from a server whose whole clock runs 5 min ahead', () => {
    // Its Date is 5 min ahead as well, so the read is not later than it says it served it.
    const served = RENDERED + POLL;
    const ahead = presenceAfterPoll(
      answer('dnd', served + 5 * MINUTE - SECOND),
      served + LATENCY + skew,
      undefined,
      dateOf(served + 5 * MINUTE),
      timesOf(served),
    );
    expect(statusOf(ahead)).toBe('dnd');
    // The next answers come from servers on real time: the first of them shows.
    const honest = poll(answer('idle', served + POLL - 2 * SECOND), served + POLL, skew, ahead);
    expect(statusOf(honest)).toBe('idle');
    const older = poll(answer('dnd', served + POLL - 9 * SECOND), served + 2 * POLL, skew, honest);
    expect(older).toBe(honest);
  });
});

/** Steps of the device clock between two polls: its wall clock moves, its monotonic clock not. */
const STEPS = [
  ['5 s forward', 5 * SECOND],
  ['20 s forward', 20 * SECOND],
  ['1 min forward', MINUTE],
  ['2 min forward', 2 * MINUTE],
  ['10 min forward', 10 * MINUTE],
  ['10 min back', -10 * MINUTE],
] as const;

describe.each(STEPS)('the presence when the device clock steps %s between polls', (_, step) => {
  // A read made 100 ms before it was served reaches a browser 5 min behind; the polls after it
  // reach that browser after its clock has stepped.
  const served = RENDERED + POLL;
  const newest = served - 100;
  const behind = -5 * MINUTE;
  const stepped = behind + step;
  const newer = () => poll(answer('dnd', newest), served, behind);
  /** How old the age line says `dated` is, read on the stepped clock at poll `n`'s arrival. */
  const ageAtPoll = (dated: DatedPresence, n: number) =>
    served + n * POLL + LATENCY + stepped - dated.readAt;

  it.each([1, 3, 10, 30])('keeps the newer presence over a copy %i s older', (olderBy) => {
    const shown = newer();
    const copy = answer('idle', newest - olderBy * SECOND);
    const after = poll(copy, served + POLL, stepped, shown);
    expect(statusOf(after)).toBe('dnd');
    expect(after.statedAt).toBe(newest);
  });

  it('keeps the true age of the presence it keeps, read on the stepped clock', () => {
    const shown = newer();
    const again = poll(answer('dnd', newest), served + POLL, stepped, shown);
    const copy = answer('idle', newest - 30 * SECOND);
    const after = poll(copy, served + 2 * POLL, stepped, again);
    // Each poll ages the read by a poll, never by the step.
    expect(ageAtPoll(again, 1)).toBe(ageOnArrival(shown) + POLL);
    expect(ageAtPoll(after, 2)).toBe(ageOnArrival(shown) + 2 * POLL);
    expect(statusOf(after)).toBe('dnd');
  });

  it('shows the next newer read at once', () => {
    const next = poll(answer('online', served + POLL - 100), served + POLL, stepped, newer());
    expect(statusOf(next)).toBe('online');
  });
});

describe('an answer that reaches the browser seconds after its Date', () => {
  it.each([0.5, 1, 1.5])('keeps the newer presence over a copy read %d s before it', (olderBy) => {
    // The newer read was served 100 ms after it was made and arrived at once. The copy was
    // served late in its Date's second and took 3.5 s to arrive.
    const served = RENDERED + POLL;
    const shown = poll(answer('dnd', served - 100), served, 0);
    const lateServed = dateOf(served + POLL) + 900;
    const copy = answer('idle', served - 100 - olderBy * SECOND);
    const after = presenceAfterPoll(
      copy,
      lateServed + 3_500,
      shown,
      dateOf(lateServed),
      timesOf(lateServed, 3_500),
    );
    expect(after).toBe(shown);
  });
});

describe('reads less than a second apart', () => {
  // Both are served within one second of the Date: the Date cannot tell them apart, read_at can.
  const DATE = dateOf(RENDERED) + POLL;

  it('keeps the later read over one made 300 ms before it', () => {
    const later = presenceAfterPoll(answer('dnd', DATE + 600), DATE + 900, undefined, DATE);
    // A read later in the Date's own second is not taken for a read ahead of the server.
    expect(later.statedAt).toBe(DATE + 600);
    expect(later.serverReadAt).toBe(DATE + 600);
    const before = presenceAfterPoll(
      answer('idle', DATE + 300),
      DATE + POLL + 900,
      later,
      DATE + POLL,
    );
    expect(before).toBe(later);
  });

  it('shows a read made 200 ms after the one shown', () => {
    const shown = presenceAfterPoll(answer('dnd', DATE + 600), DATE + 900, undefined, DATE);
    const next = presenceAfterPoll(
      answer('idle', DATE + 800),
      DATE + POLL + 900,
      shown,
      DATE + POLL,
    );
    expect(statusOf(next)).toBe('idle');
  });
});

describe('an answer without a Date header', () => {
  it('orders reads by this browser’s clock, as before: in step, an older copy is kept', () => {
    const newer = presenceAfterPoll(answer('dnd', RENDERED - 2 * SECOND), RENDERED);
    expect(newer.readAt).toBe(RENDERED - 2 * SECOND);
    const older = answer('idle', RENDERED - 32 * SECOND);
    expect(presenceAfterPoll(older, RENDERED + POLL, newer)).toBe(newer);
  });

  it('dates a read that lies after its arrival by the arrival', () => {
    const dated = presenceAfterPoll(answer('dnd', RENDERED + 20 * SECOND), RENDERED);
    expect(dated.readAt).toBe(RENDERED);
    expect(dated.serverReadAt).toBe(RENDERED);
  });
});
