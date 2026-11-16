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
 * @file The console Discord tile's live rules (discord-tile.tsx), with the clock and both polls
 * in the test's hands:
 * - Spotify's own song fills in while Discord reports no listening, and never once it is two
 *   polls old;
 * - while Discord reports listening that answer is dropped, so the fallback asks again after;
 * - a failed presence poll keeps the last presence and its age;
 * - a polled presence is dated by when the server read Lanyard, when the answer says, and an
 *   answer read before the presence shown never replaces it (its age keeps counting);
 * - by a browser clock behind the server's, answers that carry the server's Date are ordered
 *   and aged by the server's clock: an older cached copy never replaces a newer presence;
 * - nor when the device clock steps forward or back between polls, and the presence kept says
 *   its true age (it showed the older copy, or an empty age line, until a newer read came);
 * - the server HTML hydrates whatever the browser's clock says.
 */

import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => {
  const env = { NODE_ENV: 'test', NEXT_PUBLIC_DISCORD_ID: '42' };
  return { env, default: env };
});

import { DiscordTile } from '@/app/(routes)/(dev)/stats/_components/console/discord-tile';
import type { LanyardData } from '@/app/api/v1/[[...route]]/lanyard/handlers';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';

const NOW = Date.parse('2026-11-13T18:00:00Z');
const POLL_MS = 30_000;
const LANYARD_PATH = '/api/v1/lanyard';
const NOW_PLAYING_PATH = '/api/v1/now-playing';

const USER = { username: 'womb0.comb0', discriminator: '0', avatar: '', id: '42' };
const CODE = { name: 'Visual Studio Code', type: 0, details: 'Editing a file', state: 'A repo' };
const GAME = { name: 'A Game', type: 0, details: 'In a match' };
const DISCORD_SONG = { name: 'Spotify', type: 2, details: 'A Discord song', state: 'An artist' };
const NOTHING_PLAYING: NowPlayingResponse = { isPlaying: false };

const presence = (activities: LanyardData['activities']): LanyardData => ({
  discord_status: 'online',
  discord_user: USER,
  activities,
});

const song = (songName: string): NowPlayingResponse => ({
  isPlaying: true,
  songName,
  artistName: 'An artist',
  songURL: 'https://open.spotify.com/track/abc',
});

/** What an endpoint answers: a body, an error status, a response of its own, or no answer. */
type Answer = object | number | 'pending' | (() => Response);

/** What the two polls answer right now; a test changes it between polls. */
let answers: { lanyard: Answer; nowPlaying: Answer };

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function respond(answer: Answer): Promise<Response> {
  if (answer === 'pending') return new Promise<Response>(() => {});
  if (typeof answer === 'function') return Promise.resolve(answer());
  return Promise.resolve(
    typeof answer === 'number' ? jsonResponse({ error: 'failed' }, answer) : jsonResponse(answer),
  );
}

/** Answers both polls from `answers`; anything else is a test failure. */
function stubPolls() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === LANYARD_PATH) return respond(answers.lanyard);
    if (url === NOW_PLAYING_PATH) return respond(answers.nowPlaying);
    throw new Error(`unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

interface TileSetup {
  /** When the server rendered the page. */
  readonly renderedAt?: number;
  /**
   * When the server read the presence snapshot (its activities: Visual Studio Code); null for a
   * snapshot that missed its deadline, so the island asks for itself at once.
   */
  readonly presenceAt?: number | null;
  /** The server's Spotify snapshot and when it was read. */
  readonly seedSong?: NowPlayingResponse;
  readonly songAt?: number;
}

/** The tile with the server's two snapshots, in a QueryClient of its own. */
function tile({
  renderedAt = NOW,
  presenceAt = NOW - 5_000,
  seedSong = NOTHING_PLAYING,
  songAt = NOW - 10_000,
}: TileSetup = {}): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <DiscordTile
        profileId="42"
        renderedAt={renderedAt}
        initial={
          presenceAt === null
            ? { kind: 'timeout' }
            : { kind: 'data', data: presence([CODE]), fetchedAt: presenceAt }
        }
        nowPlaying={{ kind: 'data', data: seedSong, fetchedAt: songAt }}
      />
    </QueryClientProvider>
  );
}

/** Moves the clock on, running every poll and timer due on the way. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const discordTile = () => document.querySelector('[data-stats-tile="discord"]');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  stubPolls();
});

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DiscordTile Spotify fallback', () => {
  it('shows Spotify’s own song while Discord reports no listening, until it is two polls old', async () => {
    answers = { lanyard: presence([CODE]), nowPlaying: 503 };
    render(tile({ seedSong: song('Seed song'), songAt: NOW - 10_000 }));
    expect(screen.getByText('Seed song')).toBeInTheDocument();
    expect(screen.getByText('Listening on Spotify')).toBeInTheDocument();

    // 59 s old: Spotify's poll at 30 s failed, and one failed poll keeps the song.
    await advance(49_000);
    expect(screen.getByText('Seed song')).toBeInTheDocument();

    // 61 s old: past two polls, the song is gone and Discord's own row stays.
    await advance(2_000);
    await waitFor(() => expect(screen.queryByText('Seed song')).toBeNull());
    expect(screen.queryByText('Listening on Spotify')).toBeNull();
    expect(screen.getByText('Playing Visual Studio Code')).toBeInTheDocument();
  });

  it('drops Spotify’s answer while Discord reports listening, so the fallback asks again after', async () => {
    answers = { lanyard: presence([CODE]), nowPlaying: song('Polled song') };
    render(tile({ seedSong: song('Seed song') }));
    await advance(POLL_MS);
    expect(await screen.findByText('Polled song')).toBeInTheDocument();

    // Discord reports listening: its own row leads and the fallback is off.
    answers = { lanyard: presence([DISCORD_SONG, CODE]), nowPlaying: song('Polled song') };
    await advance(POLL_MS);
    expect(await screen.findByText('A Discord song')).toBeInTheDocument();
    expect(screen.queryByText('Polled song')).toBeNull();

    // Discord stops: the song polled 30 s ago would still count as fresh, but it was dropped, so
    // the fallback asks again and shows Spotify's new answer.
    answers = { lanyard: presence([CODE]), nowPlaying: song('Next song') };
    await advance(POLL_MS);
    expect(await screen.findByText('Next song')).toBeInTheDocument();
    expect(screen.queryByText('Polled song')).toBeNull();
    expect(screen.queryByText('A Discord song')).toBeNull();
  });
});

describe('DiscordTile presence polls', () => {
  it('keeps the last presence and its age when a poll fails', async () => {
    answers = { lanyard: presence([GAME]), nowPlaying: NOTHING_PLAYING };
    render(tile());
    expect(screen.getByText('Playing Visual Studio Code')).toBeInTheDocument();
    await advance(POLL_MS);
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();

    // Two failed polls, a minute after the last answer.
    answers = { lanyard: 500, nowPlaying: NOTHING_PLAYING };
    await advance(2 * POLL_MS);
    expect(await screen.findByText('updated 1 min ago')).toBeInTheDocument();
    expect(screen.getByText('Playing A Game')).toBeInTheDocument();
    expect(discordTile()).toHaveAttribute('data-state', 'ready');
    expect(screen.queryByText(/unavailable|didn’t answer/)).toBeNull();
  });

  it('dates a polled presence by when the server read Lanyard, not when it arrived', async () => {
    // The route answers from its cache: this presence was read 90 s before the poll, after the
    // snapshot (read 170 s before the page) it replaces.
    answers = {
      lanyard: { ...presence([GAME]), read_at: NOW + POLL_MS - 90_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: NOW - 170_000 }));
    expect(screen.getByText('updated 2 min ago')).toBeInTheDocument();
    await advance(POLL_MS);
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
    expect(await screen.findByText('updated 1 min ago')).toBeInTheDocument();
    expect(screen.queryByText('updated just now')).toBeNull();
  });

  it('dates a read time sent in seconds by when it arrived, not as 1970', async () => {
    answers = {
      lanyard: { ...presence([GAME]), read_at: Math.floor((NOW + POLL_MS - 120_000) / 1000) },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile());
    await advance(POLL_MS);
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
    expect(await screen.findByText('updated just now')).toBeInTheDocument();
    expect(screen.queryByText(/ d ago$/)).toBeNull();
  });

  it('keeps the newer presence and its age when an answer was read before it', async () => {
    // The snapshot was read 50 s before the page; the route's answer 70 s before that (a cache
    // of its own, or a copy it holds while Lanyard fails).
    answers = {
      lanyard: { ...presence([GAME]), read_at: NOW - 120_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: NOW - 50_000 }));
    await advance(POLL_MS);
    expect(await screen.findByText('updated 1 min ago')).toBeInTheDocument();
    expect(screen.getByText('Playing Visual Studio Code')).toBeInTheDocument();
    expect(screen.queryByText('Playing A Game')).toBeNull();
    expect(screen.queryByText('updated just now')).toBeNull();
  });

  it('keeps counting the age while the route repeats an older answer', async () => {
    answers = {
      lanyard: { ...presence([GAME]), read_at: NOW - 300_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: NOW - 50_000 }));
    // Three polls, every one the same answer read 4 min before the snapshot.
    await advance(3 * POLL_MS);
    expect(await screen.findByText('updated 2 min ago')).toBeInTheDocument();
    expect(screen.getByText('Playing Visual Studio Code')).toBeInTheDocument();
    expect(screen.queryByText('updated just now')).toBeNull();
  });

  it('dates an answer read 10 min ago as 10 min old, and on, when there was no snapshot', async () => {
    answers = {
      lanyard: { ...presence([GAME]), read_at: NOW - 600_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: null }));
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
    expect(await screen.findByText('updated 10 min ago')).toBeInTheDocument();
    // The same answer again a minute on: it ages, never 'just now'.
    await advance(2 * POLL_MS);
    expect(await screen.findByText('updated 11 min ago')).toBeInTheDocument();
  });

  it('reads an answer read after this browser’s clock as just now, then ages it', async () => {
    // The browser's clock runs behind the server's: by it the read lies 20 s ahead on arrival.
    answers = {
      lanyard: { ...presence([GAME]), read_at: NOW + POLL_MS + 20_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: NOW - 50_000 }));
    await advance(POLL_MS);
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
    expect(await screen.findByText('updated just now')).toBeInTheDocument();
    // The next poll repeats the same read; a minute after it arrived the age says so.
    await advance(2 * POLL_MS);
    expect(await screen.findByText('updated 1 min ago')).toBeInTheDocument();
  });

  it('shows the honest answers after one the server says it read 5 min from now', async () => {
    // A server clock ahead of real time: the first poll's read lies 5 min after it arrives.
    answers = {
      lanyard: { ...presence([GAME]), read_at: NOW + POLL_MS + 300_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: NOW - 5_000 }));
    await advance(POLL_MS);
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
    expect(screen.getByText('updated just now')).toBeInTheDocument();
    // Honest answers 30 s apart, each read a second before it arrives: each one shows.
    answers = {
      lanyard: { ...presence([DISCORD_SONG]), read_at: NOW + 2 * POLL_MS - 1_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    await advance(POLL_MS);
    expect(await screen.findByText('A Discord song')).toBeInTheDocument();
    answers = {
      lanyard: { ...presence([CODE]), read_at: NOW + 3 * POLL_MS - 1_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    await advance(POLL_MS);
    expect(await screen.findByText('Playing Visual Studio Code')).toBeInTheDocument();
    expect(screen.queryByText('Playing A Game')).toBeNull();
  });

  it('shows an honest answer after a snapshot read 5 min ahead of this browser’s clock', async () => {
    answers = {
      lanyard: { ...presence([GAME]), read_at: NOW + POLL_MS - 1_000 },
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: NOW + 300_000 }));
    expect(screen.getByText('updated just now')).toBeInTheDocument();
    await advance(POLL_MS);
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
  });

  it('dates an answer that does not say when it was read by when it arrived', async () => {
    answers = { lanyard: presence([GAME]), nowPlaying: NOTHING_PLAYING };
    render(tile({ presenceAt: NOW - 50_000 }));
    expect(screen.getByText('updated 1 min ago')).toBeInTheDocument();
    await advance(POLL_MS);
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
    expect(await screen.findByText('updated just now')).toBeInTheDocument();
  });
});

describe('DiscordTile with this browser’s clock 5 min behind the server’s', () => {
  /** The browser runs 5 min behind; NOW and every read_at are on the server's clock. */
  const BEHIND = 5 * 60_000;
  const serverNow = () => Date.now() + BEHIND;
  let served = 0;

  /** The route's answer: `body`, served now with a Date header saying so (the server's clock). */
  const withDate = (body: () => object) => (): Response => {
    served += 1;
    return new Response(JSON.stringify(body()), {
      status: 200,
      headers: { 'content-type': 'application/json', date: new Date(serverNow()).toUTCString() },
    });
  };

  /** Runs the next poll and waits until its answer has been handled. */
  async function nextPoll(): Promise<void> {
    const before = served;
    await advance(POLL_MS);
    await waitFor(() => expect(served).toBe(before + 1));
    await advance(0);
  }

  beforeEach(() => {
    served = 0;
    vi.setSystemTime(NOW - BEHIND);
  });

  it('keeps the newer presence while the route alternates it with an older cached copy', async () => {
    // Odd polls: a read made 2 s before it was served; even polls: a copy read 30 s before that.
    let newest = 0;
    const newer = withDate(() => {
      newest = serverNow() - 2_000;
      return { ...presence([GAME]), discord_status: 'dnd', read_at: newest };
    });
    const older = withDate(() => ({
      ...presence([DISCORD_SONG]),
      discord_status: 'idle',
      read_at: newest - 30_000,
    }));
    answers = { lanyard: newer, nowPlaying: NOTHING_PLAYING };
    render(tile());
    for (let n = 1; n <= 4; n += 1) {
      answers = { lanyard: n % 2 ? newer : older, nowPlaying: NOTHING_PLAYING };
      await nextPoll();
      expect(screen.getByText('Playing A Game')).toBeInTheDocument();
      expect(screen.getByText('Do not disturb')).toBeInTheDocument();
      expect(screen.queryByText('Idle')).toBeNull();
      expect(screen.getByText('updated just now')).toBeInTheDocument();
    }
  });

  it('keeps the snapshot and its age when the first polls bring an older read', async () => {
    // The snapshot was read 5 s before the page; the route's copy 30 s before that.
    answers = {
      lanyard: withDate(() => ({
        ...presence([GAME]),
        discord_status: 'idle',
        read_at: NOW - 35_000,
      })),
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: NOW - 5_000 }));
    expect(screen.getByText('updated just now')).toBeInTheDocument();
    await nextPoll();
    await nextPoll();
    expect(screen.getByText('Playing Visual Studio Code')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.queryByText('Playing A Game')).toBeNull();
    // A minute and 5 s after it was read, by this browser's clock too.
    expect(await screen.findByText('updated 1 min ago')).toBeInTheDocument();
  });

  it('ages an answer read 10 min before it was served as 10 min old', async () => {
    answers = {
      lanyard: withDate(() => ({ ...presence([GAME]), read_at: serverNow() - 600_000 })),
      nowPlaying: NOTHING_PLAYING,
    };
    render(tile({ presenceAt: null }));
    await waitFor(() => expect(served).toBe(1));
    expect(await screen.findByText('Playing A Game')).toBeInTheDocument();
    expect(await screen.findByText('updated 10 min ago')).toBeInTheDocument();
  });
});

describe.each([
  ['2 min forward', 2 * 60_000],
  ['10 min forward', 10 * 60_000],
  ['10 min back', -10 * 60_000],
])('DiscordTile when the device clock steps %s between polls', (_, step) => {
  // The page's clock starts 5 min behind the server's and then steps; the server's clock is real
  // time, which the page's monotonic clock (performance.now()) follows and a step does not move.
  let serverAtStart = 0;
  let monoAtStart = 0;
  const serverNow = () => serverAtStart + performance.now() - monoAtStart;
  let served = 0;

  /** The route's answer: `body`, served now with a Date header saying so (the server's clock). */
  const withDate = (body: () => object) => (): Response => {
    served += 1;
    return new Response(JSON.stringify(body()), {
      status: 200,
      headers: { 'content-type': 'application/json', date: new Date(serverNow()).toUTCString() },
    });
  };

  /** Runs the next poll and waits until its answer has been handled. */
  async function nextPoll(): Promise<void> {
    const before = served;
    await advance(POLL_MS);
    await waitFor(() => expect(served).toBe(before + 1));
    await advance(0);
  }

  beforeEach(() => {
    served = 0;
    vi.setSystemTime(NOW - 5 * 60_000);
    serverAtStart = NOW;
    monoAtStart = performance.now();
  });

  it('keeps the newer presence over an older copy, and words its true age', async () => {
    let newest = 0;
    const newer = withDate(() => {
      newest = serverNow() - 2_000;
      return { ...presence([GAME]), discord_status: 'dnd', read_at: newest };
    });
    const again = withDate(() => ({ ...presence([GAME]), discord_status: 'dnd', read_at: newest }));
    const older = withDate(() => ({
      ...presence([DISCORD_SONG]),
      discord_status: 'idle',
      read_at: newest - 30_000,
    }));
    answers = { lanyard: newer, nowPlaying: NOTHING_PLAYING };
    render(tile());
    await nextPoll();
    expect(screen.getByText('Do not disturb')).toBeInTheDocument();
    expect(screen.getByText('updated just now')).toBeInTheDocument();

    vi.setSystemTime(Date.now() + step);
    answers = { lanyard: older, nowPlaying: NOTHING_PLAYING };
    await nextPoll();
    expect(screen.getByText('Do not disturb')).toBeInTheDocument();
    expect(screen.getByText('Playing A Game')).toBeInTheDocument();
    expect(screen.queryByText('Idle')).toBeNull();
    // 32 s after it was read, whatever the step.
    expect(screen.getByText('updated just now')).toBeInTheDocument();

    answers = { lanyard: again, nowPlaying: NOTHING_PLAYING };
    await nextPoll();
    expect(screen.getByText('Do not disturb')).toBeInTheDocument();
    expect(screen.getByText('updated 1 min ago')).toBeInTheDocument();
  });
});

describe('DiscordTile hydration', () => {
  /** Server HTML for `setup`, rendered at NOW, in a container on the page. */
  function serverHtml(setup: TileSetup): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = renderToString(tile(setup));
    document.body.append(container);
    return container;
  }

  /** Hydrates `container` with the same tile, and every hydration complaint React makes. */
  async function hydrate(container: HTMLElement, setup: TileSetup) {
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = await act(async () => hydrateRoot(container, tile(setup), { onRecoverableError }));
    const complaints = [
      ...onRecoverableError.mock.calls.map(([error]) => String(error)),
      ...consoleError.mock.calls.map((args) => args.map(String).join(' ')),
    ].filter((message) => /hydrat|did not match|didn't match/i.test(message));
    return { root, complaints };
  }

  it('hydrates the server’s Spotify row when the browser’s clock runs ahead, then drops it by that clock', async () => {
    answers = { lanyard: 'pending', nowPlaying: 'pending' };
    const setup = { seedSong: song('Seed song'), songAt: NOW - 10_000 };
    const container = serverHtml(setup);
    expect(container.textContent).toContain('Seed song');

    // The browser's clock is 55 s ahead of the server's: by it, the song is already 65 s old.
    vi.setSystemTime(NOW + 55_000);
    const { root, complaints } = await hydrate(container, setup);

    expect(complaints).toEqual([]);
    // From then on the 60 s rule reads the browser's clock.
    await waitFor(() => expect(container.textContent).not.toContain('Seed song'));
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the row through hydration while the song is under two polls old', async () => {
    answers = { lanyard: 'pending', nowPlaying: 'pending' };
    const setup = { seedSong: song('Seed song'), songAt: NOW - 10_000 };
    const container = serverHtml(setup);

    vi.setSystemTime(NOW + 1_000);
    const { root, complaints } = await hydrate(container, setup);

    expect(complaints).toEqual([]);
    await advance(0);
    expect(container.textContent).toContain('Seed song');
    act(() => root.unmount());
    container.remove();
  });

  /** The words of the presence's age line under the tile. */
  const ageLine = (container: HTMLElement) =>
    container.querySelector('[data-stats-tile="discord"] time')?.textContent;

  it('reads the snapshot as just now, never nothing, when the browser’s clock runs 90 s behind', async () => {
    answers = { lanyard: 'pending', nowPlaying: 'pending' };
    const setup = { presenceAt: NOW - 5_000 };
    const container = serverHtml(setup);
    expect(ageLine(container)).toBe('updated just now');

    // By this clock the server read the presence 85 s from now, past formatAge's minute of slack.
    vi.setSystemTime(NOW - 90_000);
    const { root, complaints } = await hydrate(container, setup);

    expect(complaints).toEqual([]);
    await waitFor(() => expect(ageLine(container)).toBe('updated just now'));
    // It ages from then on by this clock.
    await advance(60_000);
    expect(ageLine(container)).toBe('updated 1 min ago');
    act(() => root.unmount());
    container.remove();
  });

  it('reads the snapshot’s own age, not the clock’s lead, when the browser runs 90 s ahead', async () => {
    answers = { lanyard: 'pending', nowPlaying: 'pending' };
    const setup = { presenceAt: NOW - 5_000 };
    const container = serverHtml(setup);

    // The snapshot was 5 s old when the server rendered the page (NOW, by its clock), so it is
    // 5 s old on hydration whatever this browser's clock says; it ages from there.
    vi.setSystemTime(NOW + 90_000);
    const { root, complaints } = await hydrate(container, setup);

    expect(complaints).toEqual([]);
    await waitFor(() => expect(ageLine(container)).toBe('updated just now'));
    await advance(60_000);
    expect(ageLine(container)).toBe('updated 1 min ago');
    act(() => root.unmount());
    container.remove();
  });

  it('hydrates without the row the server left out, though the browser’s clock runs behind', async () => {
    answers = { lanyard: 'pending', nowPlaying: 'pending' };
    // Read 65 s before the server rendered the page: past two polls, so the HTML has no row.
    const setup = { seedSong: song('Seed song'), songAt: NOW - 65_000 };
    const container = serverHtml(setup);
    expect(container.textContent).not.toContain('Seed song');

    vi.setSystemTime(NOW - 30_000);
    const { root, complaints } = await hydrate(container, setup);

    expect(complaints).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
