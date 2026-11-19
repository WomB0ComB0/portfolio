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
 * @file The /stats console's server loaders: every source settles on its own within its deadline
 * and never throws. The page starts them all at once and awaits none (startStatsConsole); each
 * part of the console awaits its own, so a slow source holds back only the parts that show it.
 *
 * - GitHub totals, coding time and page views use the handlers' actual load timestamps, even
 *   when a v1 request populated the cache before the first Stats visit. An answer older than the
 *   handler's hour (served because the reload failed) is stale.
 * - Past the deadline, a source shows the answer it last gave, marked stale; with none, its
 *   error state.
 * - Zero page views is no count (the Google handler answers 0 when it fails), not a figure.
 * - LeetCode and typing reuse the home loaders and take when they were read from their caches.
 * - Discord is a live snapshot: data, a timeout (the island fetches for itself) or an error.
 *
 * Every source and the reporter are mocked; React's cache() does nothing outside a server render.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  github: { getGitHubStats: vi.fn(), peekGitHubStats: vi.fn() },
  wakatime: { getWakaTimeData: vi.fn(), peekWakaTimeData: vi.fn() },
  google: { getGoogleAnalytics: vi.fn(), peekGoogleAnalytics: vi.fn() },
  lanyard: { getLanyardSnapshot: vi.fn() },
  leetcode: { peekLeetCodeStats: vi.fn() },
  monkeytype: { peekMonkeytypeProfile: vi.fn() },
  home: {
    loadGitHubActivity: vi.fn(),
    loadLeetCode: vi.fn(),
    loadTyping: vi.fn(),
    loadNowPlaying: vi.fn(),
  },
  report: { reportApiFailure: vi.fn() },
  /** Next's after(): what the page hands over to keep running once its response has ended. */
  next: { after: vi.fn() },
}));

vi.mock('next/server', () => h.next);
vi.mock('@/app/api/v1/[[...route]]/github-stats/handlers', () => h.github);
vi.mock('@/app/api/v1/[[...route]]/wakatime/handlers', () => h.wakatime);
vi.mock('@/app/api/v1/[[...route]]/google/handlers', () => h.google);
vi.mock('@/app/api/v1/[[...route]]/lanyard/handlers', () => h.lanyard);
vi.mock('@/app/api/v1/[[...route]]/leetcode/handlers', () => h.leetcode);
vi.mock('@/lib/api-integrations/monkeytype', () => h.monkeytype);
vi.mock('@/app/_components/home/data/loaders', () => h.home);
vi.mock('@/lib/observability/report', () => h.report);

const T0 = new Date('2026-11-10T15:00:00Z').getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const iso = (ms: number) => new Date(ms).toISOString();

const TOTALS = {
  user: { repos: 324, followers: 190, avatar_url: 'https://example.com/a.png' },
  stats: { totalStars: 87, topLanguages: ['TypeScript'] },
  topRepos: [],
};
const WAKA = {
  text: '4,223 hrs',
  digital: '4223:00',
  decimal: '4223.00',
  total_seconds: 15_202_921,
};
const LANYARD = {
  discord_status: 'online',
  discord_user: { username: 'womb0.comb0', discriminator: '0', avatar: 'abc', id: '42' },
  activities: [],
};

const never = () => new Promise<never>(() => {});

/** A fresh copy of the loaders. */
async function loadModule() {
  vi.resetModules();
  return import('@/app/(routes)/(dev)/stats/_lib/console-loaders');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(T0);
  for (const group of Object.values(h)) {
    for (const mock of Object.values(group)) (mock as ReturnType<typeof vi.fn>).mockReset();
  }
  h.github.peekGitHubStats.mockReturnValue({ data: TOTALS, loadedAt: T0 });
  h.wakatime.peekWakaTimeData.mockReturnValue({ data: WAKA, loadedAt: T0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadGitHubTotals', () => {
  it('keeps the handler’s timestamp while it serves the same answer', async () => {
    h.github.getGitHubStats.mockResolvedValue(TOTALS);
    const { loadGitHubTotals } = await loadModule();

    await expect(loadGitHubTotals()).resolves.toEqual({
      status: 'ok',
      data: TOTALS,
      stale: false,
      asOf: iso(T0),
    });

    // Ten minutes on, the handler still serves the same cached object: same date.
    vi.setSystemTime(T0 + 10 * MINUTE);
    await expect(loadGitHubTotals()).resolves.toMatchObject({ stale: false, asOf: iso(T0) });
  });

  it('marks the same answer stale once it is older than the handler’s hour', async () => {
    h.github.getGitHubStats.mockResolvedValue(TOTALS);
    const { loadGitHubTotals } = await loadModule();
    await loadGitHubTotals();

    vi.setSystemTime(T0 + HOUR + MINUTE);
    await expect(loadGitHubTotals()).resolves.toEqual({
      status: 'ok',
      data: TOTALS,
      stale: true,
      asOf: iso(T0),
    });
  });

  it('dates a reloaded answer (a new object) afresh', async () => {
    h.github.getGitHubStats.mockResolvedValue(TOTALS);
    const { loadGitHubTotals } = await loadModule();
    await loadGitHubTotals();

    vi.setSystemTime(T0 + HOUR + MINUTE);
    const fresh = { ...TOTALS };
    h.github.getGitHubStats.mockResolvedValue(fresh);
    h.github.peekGitHubStats.mockReturnValue({ data: fresh, loadedAt: T0 + HOUR + MINUTE });
    await expect(loadGitHubTotals()).resolves.toMatchObject({
      stale: false,
      asOf: iso(T0 + HOUR + MINUTE),
    });
  });

  it('shows the last answer, stale, when the handler misses the deadline', async () => {
    h.github.getGitHubStats.mockResolvedValue(TOTALS);
    const { loadGitHubTotals, STATS_DEADLINE_MS } = await loadModule();
    await loadGitHubTotals();

    vi.setSystemTime(T0 + 2 * HOUR);
    h.github.getGitHubStats.mockImplementation(never);
    const pending = loadGitHubTotals();
    await vi.advanceTimersByTimeAsync(STATS_DEADLINE_MS);

    await expect(pending).resolves.toEqual({
      status: 'ok',
      data: TOTALS,
      stale: true,
      asOf: iso(T0),
    });
  });

  it('answers an expired cache at once, dated and stale, while one refresh runs past the response', async () => {
    h.github.peekGitHubStats.mockReturnValue({ data: TOTALS, loadedAt: T0 - HOUR - MINUTE });
    h.github.getGitHubStats.mockImplementation(never);
    const { loadGitHubTotals } = await loadModule();

    // No clock moves: the answer is there at once although the handler's refresh never ends.
    await expect(loadGitHubTotals()).resolves.toEqual({
      status: 'ok',
      data: TOTALS,
      stale: true,
      asOf: iso(T0 - HOUR - MINUTE),
    });
    expect(h.github.getGitHubStats).toHaveBeenCalledTimes(1);
    expect(h.next.after).toHaveBeenCalledTimes(1);
    expect(h.report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('waits for the handler when nothing was ever cached, up to the deadline and no longer', async () => {
    h.github.peekGitHubStats.mockReturnValue(undefined);
    h.github.getGitHubStats.mockImplementation(never);
    const { loadGitHubTotals, STATS_DEADLINE_MS } = await loadModule();
    let settled = false;
    const pending = loadGitHubTotals().finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(STATS_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ status: 'error' });
    // The load still running is kept alive past the response, so it fills the handler's cache.
    expect(h.next.after).toHaveBeenCalledTimes(1);
  });

  it('is the error state when the handler fails or misses the deadline with nothing seen', async () => {
    h.github.peekGitHubStats.mockReturnValue(undefined);
    h.github.getGitHubStats.mockRejectedValue(new Error('GitHub down'));
    const first = await loadModule();
    await expect(first.loadGitHubTotals()).resolves.toEqual({ status: 'error' });
    expect(h.report.reportApiFailure).toHaveBeenCalled();

    h.github.getGitHubStats.mockImplementation(never);
    const second = await loadModule();
    const pending = second.loadGitHubTotals();
    await vi.advanceTimersByTimeAsync(second.STATS_DEADLINE_MS);
    await expect(pending).resolves.toEqual({ status: 'error' });
  });
});

describe('source timestamps before the first Stats visit', () => {
  it('shows an old GitHub API cache as stale on the first page visit', async () => {
    h.github.getGitHubStats.mockResolvedValue(TOTALS);
    h.github.peekGitHubStats.mockReturnValue({ data: TOTALS, loadedAt: T0 - 2 * HOUR });
    const { loadGitHubTotals } = await loadModule();

    await expect(loadGitHubTotals()).resolves.toMatchObject({
      status: 'ok',
      stale: true,
      asOf: iso(T0 - 2 * HOUR),
    });
  });

  it('shows an old WakaTime API cache as stale on the first page visit', async () => {
    h.wakatime.getWakaTimeData.mockResolvedValue(WAKA);
    h.wakatime.peekWakaTimeData.mockReturnValue({ data: WAKA, loadedAt: T0 - 2 * HOUR });
    const { loadCodingTime } = await loadModule();

    await expect(loadCodingTime()).resolves.toMatchObject({
      status: 'ok',
      stale: true,
      asOf: iso(T0 - 2 * HOUR),
    });
  });

  it('dates page views by the Analytics report, not the first page visit', async () => {
    const report = { total_pageviews: 2615 };
    h.google.getGoogleAnalytics.mockResolvedValue(report);
    h.google.peekGoogleAnalytics.mockReturnValue({ data: report, loadedAt: T0 - 25 * MINUTE });
    const { loadPageViews } = await loadModule();

    await expect(loadPageViews()).resolves.toMatchObject({
      status: 'ok',
      data: 2615,
      stale: false,
      asOf: iso(T0 - 25 * MINUTE),
    });
  });

  it('uses existing handler caches when the first page visit times out', async () => {
    h.github.getGitHubStats.mockImplementation(never);
    h.wakatime.getWakaTimeData.mockImplementation(never);
    h.google.getGoogleAnalytics.mockImplementation(never);
    const loadedAt = T0 - 2 * HOUR;
    h.github.peekGitHubStats.mockReturnValue({ data: TOTALS, loadedAt });
    h.wakatime.peekWakaTimeData.mockReturnValue({ data: WAKA, loadedAt });
    h.google.peekGoogleAnalytics.mockReturnValue({ data: { total_pageviews: 2615 }, loadedAt });
    const { loadGitHubTotals, loadCodingTime, loadPageViews, STATS_DEADLINE_MS } =
      await loadModule();
    const pending = Promise.all([loadGitHubTotals(), loadCodingTime(), loadPageViews()]);
    await vi.advanceTimersByTimeAsync(STATS_DEADLINE_MS);

    expect(await pending).toEqual([
      { status: 'ok', data: TOTALS, stale: true, asOf: iso(loadedAt) },
      { status: 'ok', data: WAKA, stale: true, asOf: iso(loadedAt) },
      { status: 'ok', data: 2615, stale: true, asOf: iso(loadedAt) },
    ]);
  });

  // The handler serves the count it holds when Analytics fails, so an outage no longer hides it.
  it('shows the count the handler still holds, stale, while Analytics is asked again', async () => {
    h.google.getGoogleAnalytics.mockImplementation(never);
    h.google.peekGoogleAnalytics.mockReturnValue({
      data: { total_pageviews: 2615 },
      loadedAt: T0 - 2 * HOUR,
    });
    const { loadPageViews } = await loadModule();

    await expect(loadPageViews()).resolves.toEqual({
      status: 'ok',
      data: 2615,
      stale: true,
      asOf: iso(T0 - 2 * HOUR),
    });
    expect(h.google.getGoogleAnalytics).toHaveBeenCalledTimes(1);
  });
});

describe('loadPageViews and loadCodingTime', () => {
  it('reads page views as a figure, and zero as no count', async () => {
    h.google.getGoogleAnalytics.mockResolvedValue({ total_pageviews: 2615 });
    const { loadPageViews } = await loadModule();
    await expect(loadPageViews()).resolves.toMatchObject({ status: 'ok', data: 2615 });

    h.google.getGoogleAnalytics.mockResolvedValue({ total_pageviews: 0 });
    await expect(loadPageViews()).resolves.toEqual({ status: 'empty' });
  });

  it('passes WakaTime’s totals through, and its failure as the error state', async () => {
    h.wakatime.getWakaTimeData.mockResolvedValue(WAKA);
    const first = await loadModule();
    await expect(first.loadCodingTime()).resolves.toMatchObject({ status: 'ok', data: WAKA });

    h.wakatime.getWakaTimeData.mockRejectedValue(new Error('WakaTime down'));
    const second = await loadModule();
    await expect(second.loadCodingTime()).resolves.toEqual({ status: 'error' });
  });
});

describe('the reused home sources', () => {
  it('dates fresh LeetCode and typing results from their caches', async () => {
    const stats = { totalSolved: 692 };
    const typing = { best60: { wpm: 101, accuracy: 93 }, completedTests: 1022 };
    h.home.loadLeetCode.mockResolvedValue({ status: 'ok', data: stats, stale: false });
    h.leetcode.peekLeetCodeStats.mockReturnValue({ data: stats, loadedAt: T0 - 3 * MINUTE });
    h.home.loadTyping.mockResolvedValue({ status: 'ok', data: typing, stale: false });
    h.monkeytype.peekMonkeytypeProfile.mockReturnValue({ data: {}, loadedAt: T0 - 9 * MINUTE });
    const { loadLeetCodeStats, loadTypingStats } = await loadModule();

    await expect(loadLeetCodeStats()).resolves.toMatchObject({ asOf: iso(T0 - 3 * MINUTE) });
    await expect(loadTypingStats()).resolves.toMatchObject({ asOf: iso(T0 - 9 * MINUTE) });
  });

  it('keeps a stale result’s own date, and passes empty and error through', async () => {
    h.home.loadLeetCode.mockResolvedValue({
      status: 'ok',
      data: {},
      stale: true,
      asOf: iso(T0 - HOUR),
    });
    h.leetcode.peekLeetCodeStats.mockReturnValue({ data: {}, loadedAt: T0 });
    h.home.loadTyping.mockResolvedValue({ status: 'empty' });
    const { loadLeetCodeStats, loadTypingStats } = await loadModule();

    await expect(loadLeetCodeStats()).resolves.toMatchObject({ stale: true, asOf: iso(T0 - HOUR) });
    await expect(loadTypingStats()).resolves.toEqual({ status: 'empty' });
  });
});

describe('loadDiscord', () => {
  it('is the presence dated by when the handler read it from Lanyard, not when the page saw it', async () => {
    // The handler's copy is 45 s old (its cache holds a read for a minute).
    h.lanyard.getLanyardSnapshot.mockResolvedValue({ data: LANYARD, readAt: T0 - 45_000 });
    const { loadDiscord } = await loadModule();
    await expect(loadDiscord()).resolves.toEqual({
      kind: 'data',
      data: LANYARD,
      fetchedAt: T0 - 45_000,
    });
  });

  it('is a timeout, unreported, when Lanyard is slower than the live deadline', async () => {
    h.lanyard.getLanyardSnapshot.mockImplementation(never);
    const { loadDiscord, DISCORD_DEADLINE_MS } = await loadModule();
    const pending = loadDiscord();
    await vi.advanceTimersByTimeAsync(DISCORD_DEADLINE_MS);
    await expect(pending).resolves.toEqual({ kind: 'timeout' });
    expect(h.report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('is an error, reported as a warning, when Lanyard fails', async () => {
    h.lanyard.getLanyardSnapshot.mockRejectedValue(new Error('Lanyard down'));
    const { loadDiscord } = await loadModule();
    await expect(loadDiscord()).resolves.toEqual({ kind: 'error' });
    expect(h.report.reportApiFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: 'warning' }),
    );
  });
});

describe('loadStatsConsole', () => {
  it('settles every source on its own: one failure leaves the rest', async () => {
    h.home.loadGitHubActivity.mockResolvedValue({ status: 'error' });
    h.github.getGitHubStats.mockResolvedValue(TOTALS);
    h.home.loadLeetCode.mockResolvedValue({ status: 'empty' });
    h.home.loadTyping.mockResolvedValue({ status: 'empty' });
    h.wakatime.getWakaTimeData.mockRejectedValue(new Error('down'));
    h.google.getGoogleAnalytics.mockResolvedValue({ total_pageviews: 2615 });
    h.lanyard.getLanyardSnapshot.mockResolvedValue({ data: LANYARD, readAt: T0 });
    h.home.loadNowPlaying.mockResolvedValue({ kind: 'timeout' });
    const { loadStatsConsole } = await loadModule();

    const data = await loadStatsConsole();

    expect(data.activity).toEqual({ status: 'error' });
    expect(data.totals).toMatchObject({ status: 'ok', data: TOTALS });
    expect(data.codingTime).toEqual({ status: 'error' });
    expect(data.pageViews).toMatchObject({ status: 'ok', data: 2615 });
    expect(data.discord).toMatchObject({ kind: 'data' });
    expect(data.nowPlaying).toEqual({ kind: 'timeout' });
  });
});

describe('startStatsConsole', () => {
  it('starts every source at once and awaits none, so the page frame waits on nothing', async () => {
    // Every source hangs: starting them must still return at once, with each one asked once.
    h.home.loadGitHubActivity.mockImplementation(never);
    h.github.peekGitHubStats.mockReturnValue(undefined);
    h.github.getGitHubStats.mockImplementation(never);
    h.home.loadLeetCode.mockImplementation(never);
    h.home.loadTyping.mockImplementation(never);
    h.wakatime.peekWakaTimeData.mockReturnValue(undefined);
    h.wakatime.getWakaTimeData.mockImplementation(never);
    h.google.getGoogleAnalytics.mockImplementation(never);
    h.lanyard.getLanyardSnapshot.mockImplementation(never);
    h.home.loadNowPlaying.mockImplementation(never);
    const { startStatsConsole } = await loadModule();

    const sources = startStatsConsole();
    await vi.advanceTimersByTimeAsync(0);

    expect(Object.keys(sources).sort()).toEqual(
      [
        'activity',
        'codingTime',
        'discord',
        'leetcode',
        'nowPlaying',
        'pageViews',
        'totals',
        'typing',
      ].sort(),
    );
    for (const source of Object.values(sources)) expect(source).toBeInstanceOf(Promise);
    for (const load of [
      h.home.loadGitHubActivity,
      h.github.getGitHubStats,
      h.home.loadLeetCode,
      h.home.loadTyping,
      h.wakatime.getWakaTimeData,
      h.google.getGoogleAnalytics,
      h.lanyard.getLanyardSnapshot,
      h.home.loadNowPlaying,
    ]) {
      expect(load).toHaveBeenCalledOnce();
    }
  });

  it('lets each source settle on its own: a hung one holds back only itself', async () => {
    h.home.loadGitHubActivity.mockResolvedValue({ status: 'error' });
    h.github.getGitHubStats.mockResolvedValue(TOTALS);
    h.home.loadLeetCode.mockImplementation(never);
    h.home.loadTyping.mockResolvedValue({ status: 'empty' });
    h.wakatime.getWakaTimeData.mockResolvedValue(WAKA);
    h.google.getGoogleAnalytics.mockResolvedValue({ total_pageviews: 2615 });
    h.lanyard.getLanyardSnapshot.mockResolvedValue({ data: LANYARD, readAt: T0 });
    h.home.loadNowPlaying.mockResolvedValue({ kind: 'timeout' });
    const { startStatsConsole } = await loadModule();

    const sources = startStatsConsole();
    let leetcodeSettled = false;
    void sources.leetcode.then(() => {
      leetcodeSettled = true;
    });

    await expect(sources.totals).resolves.toMatchObject({ status: 'ok', data: TOTALS });
    await expect(sources.pageViews).resolves.toMatchObject({ status: 'ok', data: 2615 });
    await expect(sources.discord).resolves.toMatchObject({ kind: 'data' });
    await expect(sources.codingTime).resolves.toMatchObject({ status: 'ok', data: WAKA });
    expect(leetcodeSettled).toBe(false);
  });
});
