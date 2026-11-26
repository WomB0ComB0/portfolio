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
 * flags publish, write, probe or scan, where the provider keys come from, that a failed Redis
 * publish still exits 0, and that a sweep that throws exits 1 with one line on stderr.
 */

import { describe, expect, it, vi } from 'vitest';
import { pinnedFetch } from '@/lib/free-books/pinned-fetch';
import type { SweepDependencies, SweepSummary } from '@/lib/free-books/sweep';
import type { FreeBooksSecurityManifest } from '@/lib/free-books/types';
import { connectDependencies, runCli } from '../../../scripts/free-books/verify';
import { EMPTY_MANIFEST, observed, stubSweepDependencies } from './sweep-fixture';

/** Runs the CLI on stubbed clients and keeps what it printed. */
async function run(
  args: readonly string[],
  overrides: Partial<SweepDependencies> = {},
  env: Readonly<Record<string, string>> = {},
) {
  const log = vi.fn<(message: string) => void>();
  const error = vi.fn<(message: string) => void>();
  const deps = stubSweepDependencies(overrides);
  const code = await runCli({ args, env, createDependencies: () => deps, log, error });
  const printed = log.mock.calls.map(([message]) => message);
  const summaryLine = printed.find((message) => message.startsWith('{'));
  const summary = summaryLine ? (JSON.parse(summaryLine) as SweepSummary) : null;
  return { code, printed, summary, error };
}

const SCAN_KEYS = { CLOUDFLARE_ACCOUNT_ID: 'acct-1', CLOUDFLARE_URL_SCANNER_TOKEN: 'tok-1' };

describe('verify CLI', () => {
  it('runs a dry run with no publish, no write and no sandbox scan, whatever else is asked', async () => {
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const writeManifest = vi.fn();
    const submitDetonation = vi.fn(async () => null);
    const { code, summary, error } = await run(
      ['--dry-run', '--write', '--publish-redis', '--detonate-deltas'],
      { publish, writeManifest, submitDetonation },
      SCAN_KEYS,
    );

    expect(code).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(writeManifest).not.toHaveBeenCalled();
    expect(submitDetonation).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, redisPublished: false, checkedUrls: 3 });
    expect(error).not.toHaveBeenCalled();
  });

  it('publishes and writes the manifest with --write, as the scheduled run does', async () => {
    const publish = vi.fn(async (_manifest: FreeBooksSecurityManifest) => ({
      runtimePublished: true,
      fingerprintsPublished: true,
    }));
    const writeManifest = vi.fn<(text: string) => void>();
    const { code, printed, summary } = await run(
      ['--write', '--publish-redis', '--detonate-deltas'],
      { publish, writeManifest },
    );

    expect(code).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
    const written = writeManifest.mock.calls[0]?.[0] ?? '';
    expect(written.endsWith('\n')).toBe(true);
    expect(JSON.parse(written)).toEqual(publish.mock.calls[0]?.[0]);
    expect(printed.at(-1)).toMatch(
      /^Wrote updated security manifest to .*src\/lib\/free-books\/security-manifest\.json$/,
    );
    expect(summary).toMatchObject({ dryRun: false, redisPublished: true });
  });

  it('publishes without writing the file with --publish-redis alone', async () => {
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const writeManifest = vi.fn();
    const { code } = await run(['--publish-redis'], { publish, writeManifest });

    expect(code).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(writeManifest).not.toHaveBeenCalled();
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

  it('still exits 0 when the Redis publish fails, and says so in the summary', async () => {
    const { code, summary } = await run(['--write'], {
      publish: async () => ({ runtimePublished: false, fingerprintsPublished: false }),
    });

    expect(code).toBe(0);
    expect(summary).toMatchObject({ redisPublished: false, redisFingerprintsPublished: false });
  });

  it('exits 1 with one line on stderr when the sweep throws, having published and written nothing', async () => {
    const publish = vi.fn(async () => ({ runtimePublished: true, fingerprintsPublished: true }));
    const writeManifest = vi.fn();
    const { code, summary, error } = await run(['--write'], {
      publish,
      writeManifest,
      loadCatalog: async () => {
        throw new Error('GitHub raw fetch failed (503)');
      },
    });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Free books verify failed: GitHub raw fetch failed (503)');
    expect(summary).toBeNull();
    expect(publish).not.toHaveBeenCalled();
    expect(writeManifest).not.toHaveBeenCalled();
  });

  it('ignores arguments it does not know, as it always has', async () => {
    const { code, summary } = await run(['--verbose', 'extra']);

    expect(code).toBe(0);
    expect(summary).toMatchObject({ dryRun: false });
  });
});
