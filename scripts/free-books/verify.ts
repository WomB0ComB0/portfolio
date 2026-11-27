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
 * (probeLink) and content inspection of each reachable link (pinnedFetch), both DNS-pinned so the
 * runner never connects to a private, loopback, link-local or metadata address, drift checks with
 * RDAP domain age, and optional sandbox scans of drifted external links on Cloudflare URL Scanner
 * or urlscan.io, so no third-party script runs here. Neither the probe nor the inspection requests
 * a redirect hop to a link or host the run will not fetch.
 *
 * Flags:
 *   --dry-run          no Redis publish and no sandbox scans
 *   --dnsbl-only       check the hosts (and Safe Browsing) but probe no URL
 *   --publish-redis    publish the live manifest and drift state to Redis (the only output)
 *   --detonate-deltas  send drifted external links to a sandbox, when its keys are set
 *   --limit=N          probe only the first N links
 * The script never writes src/lib/free-books/security-manifest.json: that file holds the owner's
 * hand-kept pins, and committing a run's flags would make them permanent.
 * Arguments are read strictly: any other argument, a value on a flag that takes none, or a
 * --limit that is not a whole number above 0 prints one line and runs nothing.
 *
 * Exit code: 0 when the sweep finishes. 1 when the arguments are refused, when the sweep throws
 * (a run that will publish throws when it cannot read and trust last week's Redis state, so it
 * never overwrites it; a dry run reads leniently and runs without Upstash credentials), or when
 * --publish-redis was asked for and either Redis key was not saved (the summary prints first,
 * then one line on stderr says which key failed).
 *
 * Usage:
 *   bun --conditions=react-server run scripts/free-books/verify.ts --dry-run
 *   bun --conditions=react-server run scripts/free-books/verify.ts --dry-run --dnsbl-only
 *   bun --conditions=react-server run scripts/free-books/verify.ts --publish-redis --detonate-deltas
 */

import dns from 'node:dns/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type ParseArgsConfig, parseArgs } from 'node:util';
import { loadSweepCatalog } from '../../src/lib/free-books/loader';
import {
  loadLiveSecurityManifestFromRedis,
  loadVerifierDriftStateFromRedis,
  publishSecurityManifestToRedis,
} from '../../src/lib/free-books/manifest-store';
import { pinnedFetch } from '../../src/lib/free-books/pinned-fetch';
import {
  runSweep,
  type SweepDependencies,
  type SweepOptions,
  type SweepSummary,
} from '../../src/lib/free-books/sweep';
import {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
} from '../../src/lib/free-books/threat-intel';
import { probeLink } from '../../src/lib/link-health/probe';

/** The committed manifest (the owner's pins) the sweep reads; nothing writes it back. */
const MANIFEST_PATH = resolve(process.cwd(), 'src/lib/free-books/security-manifest.json');

/** Only CI has the provider keys; Redis credentials are read by the manifest store itself. */
type VerifyEnvironment = Readonly<Record<string, string | undefined>>;

/** Every argument the script accepts; anything else is refused before the sweep starts. */
const VERIFY_FLAGS = {
  'dry-run': { type: 'boolean' },
  'dnsbl-only': { type: 'boolean' },
  'publish-redis': { type: 'boolean' },
  'detonate-deltas': { type: 'boolean' },
  limit: { type: 'string' },
} as const satisfies NonNullable<ParseArgsConfig['options']>;

/** A whole number above 0, written plainly (no sign, decimal point or leading zero). */
const POSITIVE_INTEGER = /^[1-9]\d*$/;

async function resolveExists(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.resolve4(hostname);
    return addrs.length > 0;
  } catch {
    return false;
  }
}

/** The real clients: Redis, GitHub raw, DNS, the threat feeds, and the DNS-pinned probe and fetch. */
export function connectDependencies(): SweepDependencies {
  return {
    readManifest: () => readFileSync(MANIFEST_PATH, 'utf8'),
    loadLiveManifest: loadLiveSecurityManifestFromRedis,
    loadDriftState: loadVerifierDriftStateFromRedis,
    publish: publishSecurityManifestToRedis,
    loadCatalog: loadSweepCatalog,
    loadThreatFeeds: loadUrlhausHostBlocklist,
    resolvesNormally: resolveExists,
    checkHost: checkHostnameThreatIntel,
    checkSafeBrowsing: checkGoogleSafeBrowsing,
    probe: probeLink,
    fetch: pinnedFetch,
    checkDomainAge: checkRdapDomainAge,
    submitDetonation: submitDeltaDetonation,
  };
}

/**
 * Why strict parsing refused `args`, in plain words: the first argument that is unknown, a stray
 * positional, a value on a flag that takes none, or a --limit with no value.
 */
function describeRefusedArguments(args: readonly string[]): string {
  const { tokens } = parseArgs({
    args: [...args],
    options: VERIFY_FLAGS,
    strict: false,
    allowPositionals: true,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind === 'positional') return `unexpected argument ${token.value}`;
    if (token.kind !== 'option') continue;
    if (!Object.hasOwn(VERIFY_FLAGS, token.name)) return `unknown argument ${token.rawName}`;
    const { type } = VERIFY_FLAGS[token.name as keyof typeof VERIFY_FLAGS];
    if (type === 'boolean' && token.value !== undefined) return `${token.rawName} takes no value`;
    if (type === 'string' && token.value === undefined) {
      return `${token.rawName} needs a value, as in ${token.rawName}=50`;
    }
  }
  return `could not read the arguments ${args.join(' ')}`;
}

/** `--limit=N` as a number of links; anything but a whole number above 0 is refused. */
function readLimit(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const limit = Number(raw);
  if (!POSITIVE_INTEGER.test(raw) || !Number.isSafeInteger(limit)) {
    throw new Error(`--limit must be a whole number above 0 (got ${raw === '' ? 'nothing' : raw})`);
  }
  return limit;
}

/** The flags in `args`, parsed strictly; a refusal throws one plain-English line. */
function parseFlags(args: readonly string[]) {
  try {
    return parseArgs({
      args: [...args],
      options: VERIFY_FLAGS,
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    throw new Error(describeRefusedArguments(args));
  }
}

/** The run's options from its arguments (read strictly) and environment. */
function readOptions(args: readonly string[], env: VerifyEnvironment): SweepOptions {
  const values = parseFlags(args);
  const dryRun = values['dry-run'] === true;
  return {
    dryRun,
    dnsblOnly: values['dnsbl-only'] === true,
    shouldPublishRedis: values['publish-redis'] === true && !dryRun,
    detonateDeltas: values['detonate-deltas'] === true,
    maxUrls: readLimit(values.limit),
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

const yesNo = (saved: boolean): string => (saved ? 'yes' : 'no');

/** Why a run that asked to publish did not finish publishing, or null when both keys saved. */
function unfinishedPublish(options: SweepOptions, summary: SweepSummary): string | null {
  if (!options.shouldPublishRedis) return null;
  if (summary.redisPublished && summary.redisFingerprintsPublished) return null;
  return `the Redis publish did not finish (live manifest saved: ${yesNo(summary.redisPublished)}, drift state saved: ${yesNo(summary.redisFingerprintsPublished)})`;
}

/**
 * Runs one sweep. 0 when it finishes; 1, with one line on stderr, when the arguments are refused
 * (before any client is created), when the sweep throws, or when a requested publish failed.
 */
export async function runCli({
  args = process.argv.slice(2),
  env = process.env,
  createDependencies = connectDependencies,
  log = console.log,
  error = console.error,
}: CliOptions = {}): Promise<number> {
  const fail = (reason: string): number => {
    error(`Free books verify failed: ${reason}`);
    return 1;
  };
  try {
    const options = readOptions(args, env);
    const summary = await runSweep(options, createDependencies(), log);
    const unfinished = unfinishedPublish(options, summary);
    return unfinished ? fail(unfinished) : 0;
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  void runCli().then((code) => {
    process.exitCode = code;
  });
