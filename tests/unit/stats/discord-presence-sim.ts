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
 * @file Simulated visits to /stats for the Discord tile's property test
 * (discord-presence-property.test.ts), run through the real snapshotPresence and
 * presenceAfterPoll.
 *
 * Each visit: the page renders a snapshot, hydrates, then polls ten times, 30 s apart. Every
 * server's clock is right, and each Date header is its second, rounded down. The browser's wall
 * clock is up to 15 min off and may step forward or back between polls, by 1 s to 15 min (spread
 * evenly over the orders of magnitude, so steps of a few seconds come up as often as steps of
 * minutes). Its monotonic clock (performance.now()) never steps. Requests take up to 1 s to
 * arrive and their answers up to 4 s more, so an answer reaches the page 0 to 5 s after its Date.
 * Each answer is a fresh read, another instance's copy read up to 5 s before the newest read, or
 * a copy of any earlier read, in random order; settings may add copies through a cache that keeps
 * the origin's Date and adds its Age, or reads stated after their server served them.
 *
 * After each poll it checks what the tile would show against the truth: whether an older read
 * replaced a newer one, whether a newer read was kept out, and how far the age line's words
 * (its moment against this browser's clock at that instant) are from the read's true age.
 */

import {
  type DatedPresence,
  presenceAfterPoll,
  snapshotPresence,
} from '@/app/(routes)/(dev)/stats/_lib/discord-presence';

export interface SimSetting {
  readonly name: string;
  /** Device clock steps in a visit (0, 1 or 2), each between two polls. */
  readonly steps: 0 | 1 | 2;
  readonly direction: 'forward' | 'backward' | 'either';
  /** Copies come through a cache that keeps the origin's Date and adds its Age (90 s at most). */
  readonly cacheAge?: boolean;
  /** One answer in seven says it was read 3 s to 10 min after its server served it. */
  readonly futureReads?: boolean;
}

export interface SimStats {
  readonly runs: number;
  readonly polls: number;
  /** Visits in which an older read replaced a newer one at least once. */
  readonly olderShownRuns: number;
  readonly olderShownPolls: number;
  /** How much older the oldest such read was than the one it replaced (ms). */
  readonly mostOlderMs: number;
  /**
   * Polls whose answer was read after the read shown and was kept out. After a read stated past
   * its serve, only answers read more than the Date's 2 s of slack after that serve count.
   */
  readonly heldBackPolls: number;
  /** The most the age line read older than the read's true age (ms). */
  readonly mostAgeOverMs: number;
  /** The most it read younger (ms). */
  readonly mostAgeUnderMs: number;
  /** Polls after which the moment lay over a minute ahead of the wall clock (no words). */
  readonly unwordedPolls: number;
  /**
   * The floor: the most the bound on the shown read (its answer's serve plus 2 s, less the
   * monotonic time from the shown arrival to the request; shownReadBy in discord-presence.ts)
   * fell below the shown read's own server read time (ms).
   */
  readonly mostBoundBelowReadMs: number;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const POLL = 30 * SECOND;
const POLLS = 10;
const HEADER_SLACK = 2 * SECOND;
const LONGEST_CACHED = 90 * SECOND;
const MAX_OFFSET = 15 * MINUTE;
const SMALLEST_STEP = SECOND;
const LARGEST_STEP = 15 * MINUTE;
const UNWORDED_AHEAD = MINUTE;
const START = Date.parse('2026-11-14T18:00:00.000Z');
const USER = { username: 'womb0.comb0', discriminator: '0', avatar: '', id: '42' };

type Random = () => number;

/** mulberry32: a small seeded generator, so a failing run can be replayed. */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const between = (random: Random, low: number, high: number) => low + random() * (high - low);
const wholeSecond = (at: number) => Math.floor(at / SECOND) * SECOND;

/** A step's size, log-uniform between 1 s and 15 min, signed by `direction`. */
function stepSize(random: Random, direction: SimSetting['direction']): number {
  const size = Math.exp(between(random, Math.log(SMALLEST_STEP), Math.log(LARGEST_STEP)));
  const back = direction === 'backward' || (direction === 'either' && random() < 0.5);
  return back ? -size : size;
}

/** The polls (1-based) after whose previous answer the wall clock steps, and by how much. */
function stepPlan(random: Random, setting: SimSetting): Map<number, number> {
  const plan = new Map<number, number>();
  while (plan.size < setting.steps) {
    const poll = 1 + Math.floor(random() * POLLS);
    if (!plan.has(poll)) plan.set(poll, stepSize(random, setting.direction));
  }
  return plan;
}

/** What is true of a read: when it was made and, for one stated past its serve, that serve. */
interface Truth {
  readonly read: number;
  readonly statedPastServeAt?: number;
}

/** One answer of the route: what it says, what is true, and its headers' time of serve. */
interface Answer {
  readonly json: object;
  readonly truth: Truth;
  readonly servedAt: number;
}

/** The route's answer served at `served`: fresh, a copy of an earlier read, or stated ahead. */
function answerAt(random: Random, setting: SimSetting, served: number, reads: number[]): Answer {
  const kind = random();
  const body = (status: string, readAt: number) => ({
    discord_status: status,
    discord_user: USER,
    activities: [],
    read_at: readAt,
  });
  if (setting.futureReads && kind < 1 / 7) {
    const read = served - random() * SECOND;
    reads.push(read);
    const stated = served + between(random, 3 * SECOND, 10 * MINUTE);
    return {
      json: body('dnd', stated),
      truth: { read, statedPastServeAt: served },
      servedAt: wholeSecond(served),
    };
  }
  if (kind < 0.45) {
    const read = served - random() * 2 * SECOND;
    reads.push(read);
    return { json: body('online', read), truth: { read }, servedAt: wholeSecond(served) };
  }
  // Another instance's copy, read moments before the newest read (up to 5 s), or any earlier read.
  const read =
    kind < 0.6
      ? Math.max(...reads) - random() * 5 * SECOND
      : (reads[Math.floor(random() * reads.length)] ?? served);
  if (!setting.cacheAge) {
    return { json: body('idle', read), truth: { read }, servedAt: wholeSecond(served) };
  }
  // The cache got its copy from the origin no earlier than the read and holds it 90 s at most.
  const origin = between(random, Math.max(read, served - LONGEST_CACHED), served);
  const age = Math.floor((served - origin) / SECOND);
  return {
    json: body('idle', read),
    truth: { read },
    servedAt: wholeSecond(origin) + age * SECOND,
  };
}

interface Tally {
  polls: number;
  olderShownPolls: number;
  mostOlderMs: number;
  heldBackPolls: number;
  mostAgeOverMs: number;
  mostAgeUnderMs: number;
  unwordedPolls: number;
  mostBoundBelowReadMs: number;
}

/** How far the bound on `shown` for an answer served at `servedAt` falls below its read. */
function boundBelowRead(shown: DatedPresence, servedAt: number, sentMono: number): number {
  if (shown.serverReadAt === undefined || shown.arrivedMono === undefined) return 0;
  const bound = servedAt + HEADER_SLACK - (sentMono - shown.arrivedMono);
  return shown.serverReadAt - bound;
}

/** Checks what shows after a poll against the truth, into `tally`. Whether it went older. */
function check(
  tally: Tally,
  before: Truth,
  answer: Truth,
  shownAnswer: boolean,
  ageAt: { readonly wall: number; readonly real: number; readonly moment: number },
): boolean {
  tally.polls += 1;
  let older = false;
  if (shownAnswer && answer.read < before.read) {
    older = true;
    tally.olderShownPolls += 1;
    tally.mostOlderMs = Math.max(tally.mostOlderMs, before.read - answer.read);
  }
  const newerFrom =
    before.statedPastServeAt === undefined ? before.read : before.statedPastServeAt + HEADER_SLACK;
  if (!shownAnswer && answer.read > newerFrom) tally.heldBackPolls += 1;
  const shown = shownAnswer ? answer : before;
  const ageShown = Math.max(0, ageAt.wall - ageAt.moment);
  const trueAge = ageAt.real - shown.read;
  tally.mostAgeOverMs = Math.max(tally.mostAgeOverMs, ageShown - trueAge);
  tally.mostAgeUnderMs = Math.max(tally.mostAgeUnderMs, trueAge - ageShown);
  if (ageAt.moment - ageAt.wall > UNWORDED_AHEAD) tally.unwordedPolls += 1;
  return older;
}

/** One visit: the snapshot, then ten polls. Whether an older read ever replaced a newer one. */
function visit(random: Random, setting: SimSetting, tally: Tally): boolean {
  const renderedAt = START + random() * 3_600_000;
  const pageOpenedAt = renderedAt - between(random, SECOND, MINUTE);
  let offset = between(random, -MAX_OFFSET, MAX_OFFSET);
  const wall = (at: number) => at + offset;
  const mono = (at: number) => at - pageOpenedAt;
  const plan = stepPlan(random, setting);

  const fetchedAt = renderedAt - random() * MINUTE;
  const hydratedAt = renderedAt + between(random, 200, 3 * SECOND);
  const seed = { discord_status: 'online', discord_user: USER, activities: [] };
  let shown: DatedPresence = snapshotPresence(
    seed,
    fetchedAt,
    wall(hydratedAt),
    renderedAt,
    mono(hydratedAt),
  );
  let truth: Truth = { read: fetchedAt };
  const reads = [fetchedAt];
  let wentOlder = false;

  for (let poll = 1; poll <= POLLS; poll += 1) {
    offset += plan.get(poll) ?? 0;
    const sent = renderedAt + poll * POLL + random() * 2 * SECOND;
    const served = sent + random() * SECOND;
    const arrived = served + random() * 4 * SECOND;
    const answer = answerAt(random, setting, served, reads);
    tally.mostBoundBelowReadMs = Math.max(
      tally.mostBoundBelowReadMs,
      boundBelowRead(shown, answer.servedAt, mono(sent)),
    );
    const next = presenceAfterPoll(answer.json, wall(arrived), shown, answer.servedAt, {
      sent: mono(sent),
      received: mono(arrived),
    });
    const shownAnswer = next.presence !== shown.presence;
    const ageAt = { wall: wall(arrived), real: arrived, moment: next.readAt };
    if (check(tally, truth, answer.truth, shownAnswer, ageAt)) wentOlder = true;
    if (shownAnswer) truth = answer.truth;
    shown = next;
  }
  return wentOlder;
}

/** `runs` visits in `setting`, from `seed`, tallied. */
export function simulate(setting: SimSetting, runs: number, seed: number): SimStats {
  const random = seeded(seed);
  const tally: Tally = {
    polls: 0,
    olderShownPolls: 0,
    mostOlderMs: 0,
    heldBackPolls: 0,
    mostAgeOverMs: Number.NEGATIVE_INFINITY,
    mostAgeUnderMs: Number.NEGATIVE_INFINITY,
    unwordedPolls: 0,
    mostBoundBelowReadMs: Number.NEGATIVE_INFINITY,
  };
  let olderShownRuns = 0;
  for (let run = 0; run < runs; run += 1) {
    if (visit(random, setting, tally)) olderShownRuns += 1;
  }
  return { runs, olderShownRuns, ...tally };
}

/** The settings the property test runs, each with every server's clock right. */
export const SIM_SETTINGS: readonly SimSetting[] = [
  { name: 'browser clock off, no step', steps: 0, direction: 'either' },
  { name: 'one forward step', steps: 1, direction: 'forward' },
  { name: 'one backward step', steps: 1, direction: 'backward' },
  { name: 'two steps either way', steps: 2, direction: 'either' },
  {
    name: 'two steps, copies through a cache with Age',
    steps: 2,
    direction: 'either',
    cacheAge: true,
  },
  {
    name: 'two steps, reads stated past their serve',
    steps: 2,
    direction: 'either',
    futureReads: true,
  },
];
