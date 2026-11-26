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
 * The weekly security and reachability sweep of EbookFoundation/free-programming-books, run by
 * .github/workflows/free-books-verify.yml. A thin CLI over src/lib/free-books/sweep.ts, which
 * lists the phases: threat feeds (HaGeZi and OpenPhish, plus URLhaus with a key), Cloudflare
 * 1.1.1.2 and Quad9 per host, optional Google Safe Browsing, a two-pass reachability probe
 * (probeLink, DNS-pinned) and content inspection of each reachable link (plain fetch, not
 * pinned), drift checks with RDAP domain age, and optional sandbox scans of drifted external
 * links on Cloudflare URL Scanner or urlscan.io, so no third-party script runs here.
 *
 * Flags:
 *   --dry-run          no Redis publish, no file write and no sandbox scans
 *   --dnsbl-only       check the hosts (and Safe Browsing) but probe no URL
 *   --write            write src/lib/free-books/security-manifest.json and publish to Redis
 *   --publish-redis    publish to Redis
 *   --detonate-deltas  send drifted external links to a sandbox, when its keys are set
 *   --limit=N          probe only the first N links
 * Any other argument is ignored. The exit code is 0 unless the sweep throws, including when the
 * Redis publish fails (the summary prints redisPublished: false).
 *
 * Usage:
 *   bun --conditions=react-server run scripts/free-books/verify.ts --dry-run
 *   bun --conditions=react-server run scripts/free-books/verify.ts --dnsbl-only --write
 *   bun --conditions=react-server run scripts/free-books/verify.ts --write
 */

import dns from 'node:dns/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadFreeProgrammingBooks } from '../../src/lib/free-books/loader';
import {
  loadLiveSecurityManifestFromRedis,
  loadVerifierDriftStateFromRedis,
  publishSecurityManifestToRedis,
} from '../../src/lib/free-books/manifest-store';
import {
  runSweep,
  type SweepDependencies,
  type SweepOptions,
} from '../../src/lib/free-books/sweep';
import {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
} from '../../src/lib/free-books/threat-intel';
import { probeLink } from '../../src/lib/link-health/probe';

/** The committed manifest the sweep reads and, with --write, rewrites. */
const MANIFEST_PATH = resolve(process.cwd(), 'src/lib/free-books/security-manifest.json');

/** Only CI has the provider keys; Redis credentials are read by the manifest store itself. */
type VerifyEnvironment = Readonly<Record<string, string | undefined>>;

async function resolveExists(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.resolve4(hostname);
    return addrs.length > 0;
  } catch {
    return false;
  }
}

function connectDependencies(): SweepDependencies {
  return {
    readManifest: () => readFileSync(MANIFEST_PATH, 'utf8'),
    writeManifest: (text) => writeFileSync(MANIFEST_PATH, text, 'utf8'),
    loadLiveManifest: loadLiveSecurityManifestFromRedis,
    loadDriftState: loadVerifierDriftStateFromRedis,
    publish: publishSecurityManifestToRedis,
    loadCatalog: loadFreeProgrammingBooks,
    loadThreatFeeds: loadUrlhausHostBlocklist,
    resolvesNormally: resolveExists,
    checkHost: checkHostnameThreatIntel,
    checkSafeBrowsing: checkGoogleSafeBrowsing,
    probe: probeLink,
    fetch: (input, init) => fetch(input, init),
    checkDomainAge: checkRdapDomainAge,
    submitDetonation: submitDeltaDetonation,
  };
}

/** The run's options from its arguments and environment, read as the script always has. */
function readOptions(args: readonly string[], env: VerifyEnvironment): SweepOptions {
  const flags = new Set(args);
  const dryRun = flags.has('--dry-run');
  const shouldWrite = flags.has('--write') && !dryRun;
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  return {
    dryRun,
    dnsblOnly: flags.has('--dnsbl-only'),
    shouldWrite,
    shouldPublishRedis: (flags.has('--publish-redis') || shouldWrite) && !dryRun,
    detonateDeltas: flags.has('--detonate-deltas'),
    maxUrls: limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '0', 10) : 0,
    manifestPath: MANIFEST_PATH,
    urlhausAuthKey: env.URLHAUS_AUTH_KEY?.trim(),
    safeBrowsingApiKey: env.GOOGLE_SAFE_BROWSING_API_KEY?.trim(),
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID?.trim(),
    cloudflareToken: env.CLOUDFLARE_URL_SCANNER_TOKEN?.trim(),
    urlscanApiKey: env.URLSCAN_API_KEY?.trim(),
  };
}

interface CliOptions {
  args?: readonly string[];
  env?: VerifyEnvironment;
  createDependencies?: () => SweepDependencies;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

/** Runs one sweep; 0 when it finishes, 1 when it throws. */
export async function runCli({
  args = process.argv.slice(2),
  env = process.env,
  createDependencies = connectDependencies,
  log = console.log,
  error = console.error,
}: CliOptions = {}): Promise<number> {
  try {
    await runSweep(readOptions(args, env), createDependencies(), log);
    return 0;
  } catch (cause) {
    error(`Free books verify failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  void runCli().then((code) => {
    process.exitCode = code;
  });
