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
 * @file scripts/free-books/verify.ts, the CLI over the sweep, with every client stubbed: which
 * flags publish, probe or scan (the scheduled workflow's own flags among them, which publish to
 * Redis and write no file), where the provider keys come from, that arguments are read strictly,
 * that a requested publish that fails exits 1 after the summary, that a publishing run refuses a
 * Redis read it cannot trust, and that a sweep that throws exits 1 with one line on stderr.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadLiveSecurityManifestFromRedis,
  loadVerifierDriftStateFromRedis,
} from '@/lib/free-books/manifest-store';
import { pinnedFetch } from '@/lib/free-books/pinned-fetch';
import type { SweepDependencies, SweepSummary } from '@/lib/free-books/sweep';
import type { FetchLike, FreeBooksSecurityManifest } from '@/lib/free-books/types';
import { connectDependencies, runCli } from '../../../scripts/free-books/verify';
import {
  EMPTY_MANIFEST,
  INDIE_GUIDE,
  inMemoryRedis,
  observed,
  pageResponse,
  stubSweepDependencies,
} from './sweep-fixture';

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The verify.ts arguments on the workflow's run line that is not the dry run. */
function scheduledWorkflowArgs(): string[] {
  const workflow = readFileSync(
    join(process.cwd(), '.github/workflows/free-books-verify.yml'),
    'utf8',
  );
  const runLines = [...workflow.matchAll(/scripts\/free-books\/verify\.ts([^\n]*)/g)].map(
    ([, rest]) => rest?.trim().split(/\s+/).filter(Boolean) ?? [],
  );
  return runLines.find((args) => !args.includes('--dry-run')) ?? [];
}

/** Runs the CLI on stubbed clients and keeps what it printed. */
async function run(
  args: readonly string[],
  overrides: Partial<SweepDependencies> = {},
  env: Readonly<Record<string, string>> = {},
) {
  const log = vi.fn<(message: string) => void>();
  const error = vi.fn<(message: string) => void>();
  const deps = stubSweepDependencies(overrides);
  const createDependencies = vi.fn(() => deps);
  const code = await runCli({ args, env, createDependencies, log, error });
  const printed = log.mock.calls.map(([message]) => message);
  const summaryLine = printed.find((message) => message.startsWith('{'));
  const summary = summaryLine ? (JSON.parse(summaryLine) as SweepSummary) : null;
  return { code, printed, summary, error, createDependencies };
}

const SCAN_KEYS = { CLOUDFLARE_ACCOUNT_ID: 'acct-1', CLOUDFLARE_URL_SCANNER_TOKEN: 'tok-1' };

describe('verify CLI', () => {
  it('runs a dry run with no publish and no sandbox scan, whatever else is asked', async () => {
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const submitDetonation = vi.fn(async () => null);
    const { code, summary, error } = await run(
      ['--dry-run', '--publish-redis', '--detonate-deltas'],
      { publish, submitDetonation },
      SCAN_KEYS,
    );

    expect(code).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(submitDetonation).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, redisPublished: false, checkedUrls: 3 });
    expect(error).not.toHaveBeenCalled();
  });

  it("runs the scheduled workflow's flags: publishes to Redis and writes no file", async () => {
    const args = scheduledWorkflowArgs();
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const { code, printed } = await run(args, { publish });

    expect(args).toEqual(['--publish-redis', '--detonate-deltas']);
    expect(code).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(printed.some((message) => message.startsWith('Wrote'))).toBe(false);
  });

  it('publishes the manifest it built with --publish-redis alone', async () => {
    const publish = vi.fn(async (_manifest: FreeBooksSecurityManifest) => ({
      runtimePublished: true,
      fingerprintsPublished: true,
    }));
    const { code, summary } = await run(['--publish-redis'], { publish });

    expect(code).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toMatchObject({ checkedHosts: 3, checkedUrls: 3 });
    expect(summary).toMatchObject({ dryRun: false, redisPublished: true });
  });

  it('inspects pages through the DNS-pinned fetch, never the global fetch', () => {
    expect(connectDependencies().fetch).toBe(pinnedFetch);
  });

  it('probes no URL with --dnsbl-only and keeps the baseline count of checked URLs', async () => {
    const probe = vi.fn(async () => observed('reachable'));
    const { summary } = await run(['--dnsbl-only'], {
      probe,
      readManifest: () => JSON.stringify({ ...EMPTY_MANIFEST, checkedUrls: 42 }),
    });

    expect(probe).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ checkedHosts: 3, checkedUrls: 42 });
  });

  it('probes only the first N links with --limit=N', async () => {
    const probe = vi.fn(async () => observed('reachable'));
    const { summary } = await run(['--limit=1'], { probe });

    expect(probe).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ checkedUrls: 1 });
  });

  it('reads the provider keys from the environment, trimmed', async () => {
    const loadThreatFeeds = vi.fn(async () => new Set<string>());
    const checkSafeBrowsing = vi.fn(async () => ({}));
    await run(
      [],
      { loadThreatFeeds, checkSafeBrowsing },
      { URLHAUS_AUTH_KEY: ' auth-key ', GOOGLE_SAFE_BROWSING_API_KEY: ' gsb-key ' },
    );

    expect(loadThreatFeeds).toHaveBeenCalledWith({ authKey: 'auth-key' });
    expect(checkSafeBrowsing).toHaveBeenCalledWith(expect.any(Array), 'gsb-key');
  });

  it('publishes a Safe Browsing hit as a quarantine, even though the page itself looks clean', async () => {
    const publish = vi.fn(async (_manifest: FreeBooksSecurityManifest) => ({
      runtimePublished: true,
      fingerprintsPublished: true,
    }));
    const { code, summary } = await run(
      ['--publish-redis'],
      {
        publish,
        checkSafeBrowsing: async () => ({ [INDIE_GUIDE]: 'google_safe_browsing:MALWARE' }),
      },
      { GOOGLE_SAFE_BROWSING_API_KEY: 'gsb-key' },
    );

    expect(code).toBe(0);
    expect(publish.mock.calls[0]?.[0].quarantinedUrls).toEqual({
      [INDIE_GUIDE]: 'google_safe_browsing:MALWARE',
    });
    expect(summary?.quarantineBreakdown).toEqual({ google_safe_browsing: 1 });
  });

  it('exits 1 when the Redis publish fails, after printing the summary', async () => {
    const { code, summary, error } = await run(['--publish-redis'], {
      publish: async () => ({ runtimePublished: false, fingerprintsPublished: false }),
    });

    expect(code).toBe(1);
    expect(summary).toMatchObject({ redisPublished: false, redisFingerprintsPublished: false });
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'Free books verify failed: the Redis publish did not finish (live manifest saved: no, drift state saved: no)',
    );
  });

  it('exits 1 when only the drift state fails to publish, since it carries the clean-run counts', async () => {
    const { code, summary, error } = await run(['--publish-redis'], {
      publish: async () => ({ runtimePublished: true, fingerprintsPublished: false }),
    });

    expect(code).toBe(1);
    expect(summary).toMatchObject({ redisPublished: true, redisFingerprintsPublished: false });
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'Free books verify failed: the Redis publish did not finish (live manifest saved: yes, drift state saved: no)',
    );
  });

  it('exits 1 with one line on stderr when the sweep throws, having published nothing', async () => {
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const { code, summary, error } = await run(['--publish-redis'], {
      publish,
      loadCatalog: async () => {
        throw new Error('GitHub raw fetch failed (503)');
      },
    });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Free books verify failed: GitHub raw fetch failed (503)');
    expect(summary).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  });

  it('refuses an argument it does not know, and runs nothing', async () => {
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const probe = vi.fn(async () => observed('reachable'));
    const loadCatalog = vi.fn(stubSweepDependencies().loadCatalog);
    const { code, error, summary, createDependencies } = await run(['--verbose', 'extra'], {
      publish,
      probe,
      loadCatalog,
    });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'Free books verify failed: unknown argument --verbose',
    );
    expect(summary).toBeNull();
    expect(createDependencies).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it.each([
    { args: ['--dryrun', '--write'], line: 'unknown argument --dryrun' },
    { args: ['--write'], line: 'unknown argument --write' },
    { args: ['--publish-redis', 'extra'], line: 'unexpected argument extra' },
    { args: ['--dry-run=yes'], line: '--dry-run takes no value' },
  ])('refuses $args with one line and publishes nothing', async ({ args, line }) => {
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const { code, error, createDependencies } = await run(args, { publish });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledExactlyOnceWith(`Free books verify failed: ${line}`);
    expect(createDependencies).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([['--limit=abc'], ['--limit=0'], ['--limit=-3'], ['--limit=1.5'], ['--limit=']])(
    'refuses %s, so a typo never probes every link',
    async (arg) => {
      const probe = vi.fn(async () => observed('reachable'));
      const { code, error } = await run([arg], { probe });

      expect(code).toBe(1);
      expect(error).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(/^Free books verify failed: --limit must be a whole number above 0/),
      );
      expect(probe).not.toHaveBeenCalled();
    },
  );

  it('refuses to publish when the Redis read fails, and leaves last week in place', async () => {
    const redis = inMemoryRedis();
    const parked = await run(['--publish-redis'], {
      ...redis.clients,
      fetch: async (input) =>
        String(input) === INDIE_GUIDE
          ? pageResponse('<html><body>This domain is for sale</body></html>')
          : pageResponse(),
    });
    expect(parked.code).toBe(0);

    redis.failReads(new DOMException('The operation timed out.', 'TimeoutError'));
    const publish = vi.fn(redis.clients.publish);
    const { code, error, summary } = await run(['--publish-redis'], {
      ...redis.clients,
      publish,
      probe: async (url) => observed(url === INDIE_GUIDE ? 'temporary' : 'reachable'),
    });
    redis.failReads(null);

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(
        /^Free books verify failed: could not read the (live manifest|drift state) from Redis \(timed out\)$/,
      ),
    );
    expect(summary).toBeNull();
    expect(publish).not.toHaveBeenCalled();
    expect(Object.keys((await redis.clients.loadLiveManifest())?.quarantinedUrls ?? {})).toEqual([
      INDIE_GUIDE,
    ]);
  });

  describe('without Upstash credentials', () => {
    /** The real Redis reads, with the credentials blanked and a fetch that must never be used. */
    function realReadsWithoutCredentials() {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
      const fetcher = vi.fn<FetchLike>(async () => {
        throw new Error('no network in tests');
      });
      const reads: Partial<SweepDependencies> = {
        loadLiveManifest: (options) => loadLiveSecurityManifestFromRedis({ ...options, fetcher }),
        loadDriftState: (options) => loadVerifierDriftStateFromRedis({ ...options, fetcher }),
      };
      return { fetcher, reads };
    }
    const pinned = JSON.stringify({
      ...EMPTY_MANIFEST,
      blockedHosts: { 'indie.example': 'Manual block' },
    });

    it('still runs a dry run, from the committed baseline', async () => {
      const { fetcher, reads } = realReadsWithoutCredentials();
      const { code, summary, error } = await run(['--dry-run'], {
        ...reads,
        readManifest: () => pinned,
      });

      expect(code).toBe(0);
      expect(error).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      expect(summary).toMatchObject({ dryRun: true, blockedHostsCount: 1 });
    });

    it('refuses a publishing run before it checks anything', async () => {
      const { reads } = realReadsWithoutCredentials();
      const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
      const { code, error } = await run(['--publish-redis'], { ...reads, publish });

      expect(code).toBe(1);
      expect(error).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(
          /^Free books verify failed: could not read the (live manifest|drift state) from Redis \(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set\)$/,
        ),
      );
      expect(publish).not.toHaveBeenCalled();
    });
  });
});
