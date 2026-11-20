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
 * @file The Discord tile's pure parts: the status in the palette's words and tones (only online
 * pulses), the hand-written Lanyard parser the island polls with (no Effect in its bundle), and
 * the activity rows, which keep the card's behaviour from #592: custom status left out, listening
 * first, at most three rows, album art only from Spotify's image host, and Spotify's own now
 * playing as the first row whenever Discord reports no listening.
 */

import { describe, expect, it } from 'vitest';
import { LiveResponseError } from '@/app/_components/home/live/live-fetch';
import {
  activityRows,
  avatarUrl,
  type DatedPresence,
  parseLanyard,
  presenceAfterPoll,
  presenceTone,
  snapshotPresence,
  statedReadAt,
} from '@/app/(routes)/(dev)/stats/_lib/discord-presence';

const USER = { username: 'womb0.comb0', discriminator: '0', avatar: 'abc123', id: '42' };

describe('presenceTone', () => {
  it('maps Discord statuses onto the palette, and only online pulses', () => {
    expect(presenceTone('online')).toEqual({ word: 'Online', tone: 'live', pulse: true });
    expect(presenceTone('idle')).toEqual({ word: 'Idle', tone: 'ongoing', pulse: false });
    expect(presenceTone('dnd')).toEqual({ word: 'Do not disturb', tone: 'down', pulse: false });
    expect(presenceTone('offline')).toEqual({ word: 'Offline', tone: 'idle', pulse: false });
  });

  it('reads a status it does not know as offline', () => {
    expect(presenceTone('invisible')).toEqual({ word: 'Offline', tone: 'idle', pulse: false });
  });
});

describe('parseLanyard', () => {
  it('reads the route’s answer, nulls as missing', () => {
    const parsed = parseLanyard({
      discord_status: 'online',
      discord_user: USER,
      activities: [
        { name: 'Spotify', type: 2, details: 'Ooo Baby Baby', state: null, assets: null },
      ],
    });
    expect(parsed.discord_status).toBe('online');
    expect(parsed.discord_user).toEqual(USER);
    expect(parsed.activities).toEqual([{ name: 'Spotify', type: 2, details: 'Ooo Baby Baby' }]);
  });

  it('treats missing activities as none', () => {
    expect(parseLanyard({ discord_status: 'idle', discord_user: USER }).activities).toEqual([]);
  });

  it('throws on an answer of the wrong shape', () => {
    expect(() => parseLanyard(null)).toThrow(LiveResponseError);
    expect(() => parseLanyard({ discord_status: 'online' })).toThrow(LiveResponseError);
    expect(() =>
      parseLanyard({ discord_status: 'online', discord_user: USER, activities: [{ type: 'x' }] }),
    ).toThrow(LiveResponseError);
  });
});

describe('statedReadAt', () => {
  const READ = Date.parse('2026-11-13T17:59:00Z');

  it('reads when the server read Lanyard, as epoch ms or an ISO time', () => {
    expect(statedReadAt({ discord_status: 'online', read_at: READ })).toBe(READ);
    expect(statedReadAt({ read_at: '2026-11-13T17:59:00Z' })).toBe(READ);
  });

  it('reads nothing from an answer that does not say, or says nonsense', () => {
    expect(statedReadAt({ discord_status: 'online' })).toBeUndefined();
    expect(statedReadAt({ read_at: 'soon' })).toBeUndefined();
    expect(statedReadAt({ read_at: null })).toBeUndefined();
    expect(statedReadAt({ read_at: 0 })).toBeUndefined();
    expect(statedReadAt({ read_at: Number.NaN })).toBeUndefined();
    expect(statedReadAt(null)).toBeUndefined();
  });

  it('reads nothing from a time that cannot be milliseconds (seconds, or before 2001)', () => {
    // Seconds instead of milliseconds read as January 1970: 'updated 20750 d ago'.
    expect(statedReadAt({ read_at: Math.floor(READ / 1000) })).toBeUndefined();
    expect(statedReadAt({ read_at: 999_999_999_999 })).toBeUndefined();
    expect(statedReadAt({ read_at: '1970-01-21T00:00:00Z' })).toBeUndefined();
    expect(statedReadAt({ read_at: 1_000_000_000_000 })).toBe(1_000_000_000_000);
  });
});

describe('presenceAfterPoll', () => {
  const ARRIVED = Date.parse('2026-11-13T18:00:30Z');
  const SECOND = 1_000;
  const SHOWN_PRESENCE = { discord_status: 'idle', discord_user: USER, activities: [] };
  const POLLED_PRESENCE = { ...SHOWN_PRESENCE, discord_status: 'online' };
  /**
   * What the tile shows: a presence the server read 50 s before the poll arrived, which arrived
   * at the poll before (30 s earlier). `readAt` is when it was read by this browser's clock,
   * `statedAt` the server's own word (null when the answer gave none, so `readAt` is its
   * arrival). These answers carry no Date, so this browser's clock stands in for the server's.
   */
  const shown = (
    readAt = ARRIVED - 50 * SECOND,
    statedAt: number | null = readAt,
  ): DatedPresence =>
    statedAt === null
      ? { presence: SHOWN_PRESENCE, readAt, arrivedAt: readAt }
      : {
          presence: SHOWN_PRESENCE,
          readAt,
          arrivedAt: Math.max(readAt, ARRIVED - 30 * SECOND),
          statedAt,
          serverReadAt: readAt,
        };
  /** The route's answer, read at `readAt` (left out when undefined). */
  const answer = (readAt?: unknown) =>
    readAt === undefined ? POLLED_PRESENCE : { ...POLLED_PRESENCE, read_at: readAt };

  it('shows a fresh answer, dated by when the server read it', () => {
    expect(presenceAfterPoll(answer(ARRIVED - SECOND), ARRIVED, shown())).toEqual({
      presence: POLLED_PRESENCE,
      readAt: ARRIVED - SECOND,
      arrivedAt: ARRIVED,
      statedAt: ARRIVED - SECOND,
      serverReadAt: ARRIVED - SECOND,
    });
  });

  it('shows an answer read 45 s ago with its own age, not as just now', () => {
    const next = presenceAfterPoll(answer(ARRIVED - 45 * SECOND), ARRIVED, shown());
    expect(next.presence).toEqual(POLLED_PRESENCE);
    expect(next.readAt).toBe(ARRIVED - 45 * SECOND);
  });

  it('keeps what it shows when the answer was read before it, 45 s or 10 min ago', () => {
    const newer = shown(ARRIVED - 44 * SECOND);
    expect(presenceAfterPoll(answer(ARRIVED - 45 * SECOND), ARRIVED, newer)).toBe(newer);
    const current = shown();
    expect(presenceAfterPoll(answer(ARRIVED - 600 * SECOND), ARRIVED, current)).toBe(current);
    // An ISO time a minute older than what is shown, likewise.
    const iso = new Date(ARRIVED - 110 * SECOND).toISOString();
    expect(presenceAfterPoll(answer(iso), ARRIVED, current)).toBe(current);
  });

  it('shows an answer read 10 min ago as 10 min old when nothing is shown yet', () => {
    expect(presenceAfterPoll(answer(ARRIVED - 600 * SECOND), ARRIVED)).toEqual({
      presence: POLLED_PRESENCE,
      readAt: ARRIVED - 600 * SECOND,
      arrivedAt: ARRIVED,
      statedAt: ARRIVED - 600 * SECOND,
      serverReadAt: ARRIVED - 600 * SECOND,
    });
  });

  it('keeps what it shows while the route repeats the same read, so its age keeps counting', () => {
    // A poll 30 s earlier showed this read; the route has nothing newer (Lanyard down, say).
    const repeated = presenceAfterPoll(answer(ARRIVED - 200 * SECOND), ARRIVED - 30 * SECOND);
    expect(repeated.readAt).toBe(ARRIVED - 200 * SECOND);
    expect(presenceAfterPoll(answer(ARRIVED - 200 * SECOND), ARRIVED, repeated)).toBe(repeated);
    // The same read again, by a browser clock behind the server's: it never moves the age.
    const ahead = presenceAfterPoll(answer(ARRIVED + 20 * SECOND), ARRIVED);
    expect(presenceAfterPoll(answer(ARRIVED + 20 * SECOND), ARRIVED + 30 * SECOND, ahead)).toBe(
      ahead,
    );
  });

  it('dates a read stated after its arrival by the arrival, and keeps the server’s word', () => {
    expect(presenceAfterPoll(answer(ARRIVED + 20 * SECOND), ARRIVED, shown())).toEqual({
      presence: POLLED_PRESENCE,
      readAt: ARRIVED,
      arrivedAt: ARRIVED,
      statedAt: ARRIVED + 20 * SECOND,
      serverReadAt: ARRIVED,
    });
  });

  it('dates an answer that does not say when it was read, or says it in seconds, by its arrival', () => {
    const arrived = { presence: POLLED_PRESENCE, readAt: ARRIVED, arrivedAt: ARRIVED };
    expect(presenceAfterPoll(answer(), ARRIVED, shown())).toEqual(arrived);
    const seconds = Math.floor((ARRIVED - 120 * SECOND) / 1000);
    expect(presenceAfterPoll(answer(seconds), ARRIVED, shown())).toEqual(arrived);
    expect(presenceAfterPoll(answer('soon'), ARRIVED)).toEqual(arrived);
  });

  it('takes the server’s word over a time that only stood in for it', () => {
    // What is shown was dated by its arrival, which says nothing of when it was read.
    const arrival = shown(ARRIVED - 20 * SECOND, null);
    expect(presenceAfterPoll(answer(ARRIVED - 45 * SECOND), ARRIVED, arrival)).toEqual({
      presence: POLLED_PRESENCE,
      readAt: ARRIVED - 45 * SECOND,
      arrivedAt: ARRIVED,
      statedAt: ARRIVED - 45 * SECOND,
      serverReadAt: ARRIVED - 45 * SECOND,
    });
  });

  it('still throws on an answer of the wrong shape, whatever it says of its read', () => {
    expect(() => presenceAfterPoll({ read_at: ARRIVED - 600 * SECOND }, ARRIVED, shown())).toThrow(
      LiveResponseError,
    );
  });
});

describe('presenceAfterPoll when a clock is off', () => {
  /** Real time when the first answer arrives. */
  const REAL = Date.parse('2026-11-13T18:00:00Z');
  const SECOND = 1_000;
  const MINUTE = 60 * SECOND;
  const POLL = 30 * SECOND;
  /** How old an honest answer is when it arrives (the route's cache). */
  const CACHED = 5 * SECOND;
  const HONEST = ['online', 'dnd', 'offline'] as const;
  const answerOf = (status: string, readAt: number) => ({
    discord_status: status,
    discord_user: USER,
    activities: [],
    read_at: readAt,
  });
  const statusOf = (dated: DatedPresence) => dated.presence.discord_status;

  /**
   * The tile's polls, 30 s apart: a first answer 'idle' that the server says it read at
   * `firstRead`, then honest answers (read by a server on real time, 5 s before they arrive). Every
   * answer arrives by a device clock `skew` off real time. What the tile shows after each poll.
   */
  function pollsAfter(
    firstRead: number,
    skew: number,
    polls: number = HONEST.length,
  ): DatedPresence[] {
    const seen = [presenceAfterPoll(answerOf('idle', firstRead), REAL + skew)];
    for (let n = 1; n <= polls; n += 1) {
      const real = REAL + n * POLL;
      const status = HONEST[(n - 1) % HONEST.length] ?? 'online';
      seen.push(presenceAfterPoll(answerOf(status, real - CACHED), real + skew, seen.at(-1)));
    }
    return seen;
  }

  it('dates a read stated 5 min ahead by its arrival, so the honest answers after it show', () => {
    const [ahead, ...after] = pollsAfter(REAL + 5 * MINUTE, 0);
    expect(ahead?.readAt).toBe(REAL);
    expect(ahead?.statedAt).toBe(REAL + 5 * MINUTE);
    expect(after.map(statusOf)).toEqual([...HONEST]);
    expect(after.map((dated) => dated.readAt - REAL)).toEqual([25, 55, 85].map((s) => s * SECOND));
  });

  it('shows honest answers 1, 10, 30 and 59 min after a read stated an hour ahead', () => {
    let shown = presenceAfterPoll(answerOf('online', REAL + 60 * MINUTE), REAL);
    const seen = [1, 10, 30, 59].map((minutes, index) => {
      const real = REAL + minutes * MINUTE;
      const status = ['idle', 'dnd', 'offline', 'idle'][index] ?? 'idle';
      shown = presenceAfterPoll(answerOf(status, real), real, shown);
      return statusOf(shown);
    });
    expect(seen).toEqual(['idle', 'dnd', 'offline', 'idle']);
  });

  it.each([
    ['fast', 2 * MINUTE],
    ['slow', -2 * MINUTE],
  ])('shows honest answers 30 s apart in turn by a device clock 2 min %s', (_, skew) => {
    const [, ...after] = pollsAfter(REAL - CACHED, skew);
    expect(after.map(statusOf)).toEqual([...HONEST]);
    // Each is dated by its read, or by its arrival where the read lies after that on this clock.
    after.forEach((dated, index) => {
      const real = REAL + (index + 1) * POLL;
      expect(dated.statedAt).toBe(real - CACHED);
      expect(dated.readAt).toBe(Math.min(real - CACHED, real + skew));
    });
  });

  it.each([
    ['fast', 2 * MINUTE],
    ['slow', -2 * MINUTE],
  ])('keeps counting from the same read while the route repeats it, clock 2 min %s', (_, skew) => {
    const first = presenceAfterPoll(answerOf('idle', REAL - CACHED), REAL + skew);
    const again = [1, 2, 3].map((n) =>
      presenceAfterPoll(answerOf('idle', REAL - CACHED), REAL + n * POLL + skew, first),
    );
    for (const dated of again) expect(dated).toBe(first);
  });

  it('keeps a newer presence over an answer read before it, by a device clock 2 min fast', () => {
    const newer = presenceAfterPoll(answerOf('idle', REAL - CACHED), REAL + 2 * MINUTE);
    const older = answerOf('online', REAL - 40 * SECOND);
    expect(presenceAfterPoll(older, REAL + POLL + 2 * MINUTE, newer)).toBe(newer);
  });

  it('shows the honest answers after a read stated 5 min ahead, by a device clock 2 min slow', () => {
    const [, ...after] = pollsAfter(REAL + 5 * MINUTE, -2 * MINUTE);
    expect(after.map(statusOf)).toEqual([...HONEST]);
  });

  it('holds a read stated 5 min ahead no longer than a device clock runs fast (2 min)', () => {
    const seen = pollsAfter(REAL + 5 * MINUTE, 2 * MINUTE, 6);
    const firstHonest = seen.findIndex((dated) => statusOf(dated) !== 'idle');
    // By this clock the read is dated at its arrival, 2 min ahead of real time; the first answer
    // read after that shows. Compared as stated, the tile held until the 5 min had passed.
    expect(firstHonest * POLL).toBeLessThanOrEqual(2 * MINUTE + POLL);
    expect(seen.slice(firstHonest).every((dated) => statusOf(dated) !== 'idle')).toBe(true);
  });
});

describe('snapshotPresence', () => {
  const READ = Date.parse('2026-11-13T18:00:00Z');
  const SNAPSHOT = { discord_status: 'online', discord_user: USER, activities: [] };

  it('keeps the snapshot’s read where it rendered after it (the server, or a clock ahead)', () => {
    expect(snapshotPresence(SNAPSHOT, READ, READ + 2_000)).toEqual({
      presence: SNAPSHOT,
      readAt: READ,
      arrivedAt: READ + 2_000,
      statedAt: READ,
      serverReadAt: READ,
    });
  });

  it('dates a snapshot read ahead of this clock by now, so a later honest answer shows', () => {
    const seed = snapshotPresence(SNAPSHOT, READ + 300_000, READ);
    expect(seed).toEqual({
      presence: SNAPSHOT,
      readAt: READ,
      arrivedAt: READ,
      statedAt: READ + 300_000,
      serverReadAt: READ,
    });
    const honest = { ...SNAPSHOT, discord_status: 'dnd', read_at: READ + 25_000 };
    expect(presenceAfterPoll(honest, READ + 30_000, seed).presence.discord_status).toBe('dnd');
    // The same read as the snapshot, polled again, keeps it and its age.
    expect(presenceAfterPoll({ ...SNAPSHOT, read_at: READ + 300_000 }, READ + 30_000, seed)).toBe(
      seed,
    );
  });
});

describe('avatarUrl', () => {
  it('builds the CDN address, and none without an avatar hash', () => {
    expect(avatarUrl(USER)).toBe('https://cdn.discordapp.com/avatars/42/abc123.png?size=96');
    expect(avatarUrl({ ...USER, avatar: '' })).toBeUndefined();
  });
});

describe('activityRows', () => {
  const listening = {
    name: 'Spotify',
    type: 2,
    details: 'Ooo Baby Baby',
    state: 'Smokey Robinson & The Miracles',
    assets: { large_image: 'spotify:ab67616d0000b273', large_text: 'Going to a Go-Go' },
  };
  const coding = { name: 'Visual Studio Code', type: 0, details: 'Editing page.tsx' };
  const custom = { name: 'Custom Status', type: 4, state: 'shipping' };
  const playing = {
    isPlaying: true,
    songName: 'Nights',
    artistName: 'Frank Ocean',
    songURL: 'https://open.spotify.com/track/1',
    imageURL: 'https://i.scdn.co/image/abc',
  };

  it('puts listening first, drops custom status, and gives Spotify art from its host only', () => {
    const rows = activityRows([coding, custom, listening], undefined);
    expect(rows.map((row) => row.heading)).toEqual([
      'Listening to Spotify',
      'Playing Visual Studio Code',
    ]);
    expect(rows[0]).toMatchObject({
      kind: 'spotify',
      primary: 'Ooo Baby Baby',
      secondary: 'Smokey Robinson & The Miracles',
      art: {
        src: 'https://i.scdn.co/image/ab67616d0000b273',
        alt: 'Album art for Going to a Go-Go',
      },
    });
    expect(rows[1]?.kind).toBe('code');
    expect(rows[1]?.art).toBeUndefined();
  });

  it('leads with Spotify’s now playing, linked, when Discord reports no listening', () => {
    const rows = activityRows([coding], playing);
    expect(rows[0]).toMatchObject({
      kind: 'spotify',
      heading: 'Listening on Spotify',
      primary: 'Nights',
      secondary: 'Frank Ocean',
      link: {
        href: 'https://open.spotify.com/track/1',
        // The row's words as shown, in order (WCAG 2.5.3): no 'by' between the song and artist.
        label: 'Listening on Spotify: Nights, Frank Ocean (opens in a new tab)',
      },
    });
    expect(rows[1]?.heading).toBe('Playing Visual Studio Code');
  });

  it('ignores Spotify when Discord already reports listening, or nothing plays', () => {
    expect(activityRows([listening], playing)).toHaveLength(1);
    expect(activityRows([], { isPlaying: false })).toEqual([]);
  });

  it('drops links and art that point anywhere but Spotify', () => {
    const [row] = activityRows([], {
      ...playing,
      songURL: 'https://evil.example/track',
      imageURL: 'http://i.scdn.co/image/abc',
    });
    expect(row?.link).toBeUndefined();
    expect(row?.art).toBeUndefined();
  });

  it('shows at most three rows', () => {
    const many = Array.from({ length: 5 }, (_, index) => ({ name: `Game ${index}`, type: 0 }));
    expect(activityRows(many, playing)).toHaveLength(3);
  });
});
