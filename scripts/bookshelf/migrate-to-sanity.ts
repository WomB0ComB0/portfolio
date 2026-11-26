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
 * @file The one-shot migration of the static bookshelf catalog (scripts/bookshelf/catalog/) into
 * Sanity, run from the repository root with the admin's CLI login:
 *
 *   bunx sanity exec scripts/bookshelf/migrate-to-sanity.ts --with-user-token -- --dry-run
 *
 * - `--dry-run` (the default): read the dataset and print the plan, with every Studio value that
 *   differs from the catalog. Writes nothing.
 * - `--apply`: check that every public/assets/bookshelf/<slug>.webp exists, upload the covers the
 *   books lack (4 at a time; Sanity dedupes identical files), commit every create and patch in one
 *   transaction (`visibility: 'sync'`, each patch guarded by the revision it was planned from),
 *   then verify.
 * - `--verify`: re-read the dataset and check the migration's invariants.
 * - `--finalize`: once the new site code is live, unset the legacy `track` (books) and `books`
 *   (shelves), then verify that none remain. `--finalize --dry-run` previews it.
 *
 * It reads with apiVersion 2024-10-14 and the raw perspective, so drafts and release versions are
 * visible: any of them stops the run, since publishing one later would undo the migration. It
 * writes only with the CLI user token (`--with-user-token`), never a token from .env. The planning
 * and checks are pure (plan-migration.ts, verify-migration.ts) and unit-tested; this file does the
 * I/O. Relative imports only: `sanity exec` does not resolve the app's '@/' alias.
 */

import { createReadStream, realpathSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './catalog/build-catalog';
import type { BookshelfCatalogInput } from './catalog/types';
import {
  asExistingDocs,
  type BookshelfMigrationPlan,
  buildMutations,
  type CoverUpload,
  candidateIds,
  type ExistingDoc,
  type FieldChange,
  isPublishedId,
  isRecord,
  planBookshelfMigration,
  type SanityMutation,
} from './plan-migration';
import {
  type DatasetStage,
  type VerificationResult,
  verifyBookshelfState,
} from './verify-migration';

/** The runtime's apiVersion; before 2025-02-19 the default perspective is raw. */
const API_VERSION = '2024-10-14';
const UPLOAD_CONCURRENCY = 4;
/** Every book and shelf, and anything else holding an id the plan would create. */
const DOCUMENTS_QUERY = '*[_type in ["book", "bookshelf"] || _id in $ids]';
/** A change group lists every change up to this many, else its first few. */
const MAX_LISTED_CHANGES = 20;
const SAMPLE_CHANGES = 3;
const PREVIEW_CHARS = 70;

const USAGE = [
  'Usage: bunx sanity exec scripts/bookshelf/migrate-to-sanity.ts --with-user-token -- [mode]',
  '  --dry-run              (default) print the plan and the Studio values kept; writes nothing',
  '  --apply                upload missing covers, then create and patch everything in one transaction',
  '  --verify               re-read the dataset and check the migration invariants',
  '  --finalize [--dry-run] after the new site is live: unset the legacy track and books fields',
].join('\n');

export type CliMode = 'help' | 'dry-run' | 'apply' | 'verify' | 'finalize' | 'finalize-dry-run';

const FLAGS = new Set(['--help', '--dry-run', '--apply', '--verify', '--finalize']);

/** The mode the arguments name; no mode flag means a dry run. Throws on anything else. */
export function parseArgs(args: readonly string[]): CliMode {
  const flags = args.filter((arg) => arg !== '--');
  if (flags.some((flag) => !FLAGS.has(flag)) || new Set(flags).size !== flags.length) {
    throw new Error('Invalid arguments');
  }
  if (flags.includes('--help')) return 'help';
  if (flags.includes('--finalize')) {
    const others = flags.filter((flag) => flag !== '--finalize');
    if (others.length === 0) return 'finalize';
    if (others.length === 1 && others[0] === '--dry-run') return 'finalize-dry-run';
    throw new Error('Invalid arguments');
  }
  if (flags.length > 1) throw new Error('Invalid arguments');
  if (flags.includes('--apply')) return 'apply';
  if (flags.includes('--verify')) return 'verify';
  return 'dry-run';
}

/** The Sanity side of the run: reads, cover uploads and the one transaction. */
export interface MigrationConnection {
  readonly projectId: string;
  readonly dataset: string;
  readonly hasToken: boolean;
  fetchDocuments(ids: readonly string[]): Promise<unknown>;
  /** Uploads one cover file and answers its image asset id. */
  uploadCover(slug: string, file: string): Promise<string>;
  commit(mutations: readonly SanityMutation[]): Promise<void>;
}

async function connectWithCliLogin(): Promise<MigrationConnection> {
  // Loaded on demand, so tests that pass their own connection never load the CLI.
  const { getCliClient } = await import('sanity/cli');
  const client = getCliClient({ apiVersion: API_VERSION, useCdn: false, perspective: 'raw' });
  const { projectId = '', dataset = '', token } = client.config();
  return {
    projectId,
    dataset,
    hasToken: typeof token === 'string' && token.length > 0,
    fetchDocuments: (ids) => client.fetch<unknown>(DOCUMENTS_QUERY, { ids: [...ids] }),
    uploadCover: async (slug, file) => {
      const asset = await client.assets.upload('image', createReadStream(file), {
        filename: `${slug}.webp`,
        contentType: 'image/webp',
      });
      return asset._id;
    },
    commit: async (mutations) => {
      await client.transaction([...mutations]).commit({ visibility: 'sync' });
    },
  };
}

const coverFileFor = (slug: string): string =>
  fileURLToPath(new URL(`../../public/assets/bookshelf/${slug}.webp`, import.meta.url));

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

export interface CliOptions {
  readonly args?: readonly string[];
  readonly connect?: () => Promise<MigrationConnection>;
  readonly loadCatalog?: () => BookshelfCatalogInput;
  readonly coverFile?: (slug: string) => string;
  readonly fileExists?: (file: string) => Promise<boolean>;
  readonly log?: (line: string) => void;
  readonly error?: (line: string) => void;
}

type Stage = 'read' | 'upload' | 'commit' | 'reread';

/** A failure, tagged with the step it happened in, so the message can say what was written. */
class StepError extends Error {
  constructor(
    readonly stage: Stage,
    readonly statusCode: number | undefined,
  ) {
    super(`Bookshelf migration failed at ${stage}`);
  }
}

async function step<T>(stage: Stage, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    const status =
      isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : undefined;
    throw new StepError(stage, status);
  }
}

/** A fixed message per step: never the SDK's error text or configuration. */
function failureMessage(failure: StepError): string {
  const status = failure.statusCode ? ` (HTTP ${failure.statusCode})` : '';
  switch (failure.stage) {
    case 'read':
      return `Could not read the dataset${status}. Nothing was written.`;
    case 'upload':
      return `A cover upload failed${status}. No document was written; uploaded covers are reused on the next run.`;
    case 'commit':
      if (failure.statusCode === 409) {
        return 'A document changed after it was read, so the transaction was rejected and nothing changed. Run --dry-run again.';
      }
      // Only a 4xx is a definite rejection; a lost response or a 5xx may follow a committed transaction.
      if (
        failure.statusCode !== undefined &&
        failure.statusCode >= 400 &&
        failure.statusCode < 500
      ) {
        return `The transaction was rejected${status}, so no document changed.`;
      }
      return `The commit failed${status} and its outcome is unknown: the transaction may have been applied. Run --verify before anything else.`;
    case 'reread':
      return `The write succeeded, but re-reading the dataset failed${status}. Run --verify.`;
  }
}

/** Runs `task` over `items`, at most `limit` at a time, keeping the results in order. */
async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const queue = items.map((item, index) => ({ item, index }));
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      results[next.index] = await task(next.item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function preview(value: unknown): string {
  if (value === undefined) return '(none)';
  const text = JSON.stringify(value) ?? String(value);
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 3)}...` : text;
}

function describeChange(change: FieldChange): string {
  return change.action === 'unset'
    ? `    ${change.slug}: ${preview(change.from)}`
    : `    ${change.slug}: ${preview(change.from)} -> ${preview(change.to)}`;
}

/** The plan as printed lines: counts, every change group, every Studio value kept. */
export function describePlan(
  plan: BookshelfMigrationPlan,
  missingCovers: readonly string[],
): string[] {
  const count = <T extends { readonly type: string }>(items: readonly T[], type: string) =>
    items.filter((item) => item.type === type).length;
  const groups = Map.groupBy(
    plan.changes,
    (change) => `${change.type}.${change.field} (${change.action})`,
  );
  const changeLines = [...groups.entries()].flatMap(([group, changes]) => {
    const listed =
      changes.length <= MAX_LISTED_CHANGES ? changes : changes.slice(0, SAMPLE_CHANGES);
    const rest = changes.length - listed.length;
    return [
      `  ${group}: ${changes.length}`,
      ...listed.map(describeChange),
      ...(rest > 0 ? [`    ... and ${rest} more`] : []),
    ];
  });
  return [
    `Plan (${plan.mode}):`,
    ...(plan.mode === 'migrate'
      ? [
          `  books:   ${count(plan.creates, 'book')} to create, ${count(plan.patches, 'book')} to patch`,
          `  shelves: ${count(plan.creates, 'bookshelf')} to create, ${count(plan.patches, 'bookshelf')} to patch`,
          `  covers:  ${plan.coverUploads.length} to upload; ${missingCovers.length} of the catalog's cover files missing`,
        ]
      : [`  patches: ${plan.patches.length}`]),
    `  already up to date: ${plan.unchanged}`,
    `Field changes: ${plan.changes.length}`,
    ...changeLines,
    `Studio values kept (they differ from the catalog): ${plan.diffs.length}`,
    ...plan.diffs.map(
      (diff) =>
        `  ${diff.type} ${diff.slug} ${diff.field}: Studio ${preview(diff.studio)} | catalog ${preview(diff.catalog)}`,
    ),
    ...missingCovers.map((slug) => `Missing cover file: public/assets/bookshelf/${slug}.webp`),
    ...plan.warnings.map((warning) => `Warning: ${warning}`),
    ...plan.errors.map((message) => `Error: ${message}`),
  ];
}

export function describeVerification(result: VerificationResult): string[] {
  const statuses = Object.entries(result.statuses)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, total]) => `${status} ${total}`)
    .join(', ');
  return [
    `Verify (${result.stage}): ${result.books} books, ${result.shelves} shelves; ${statuses || 'no statuses'}`,
    ...result.warnings.map((warning) => `  Warning: ${warning}`),
    ...(result.failures.length === 0
      ? ['  All invariants hold.']
      : result.failures.map((failure) => `  FAILED: ${failure}`)),
  ];
}

/** Runs `options.args` (process.argv by default) and answers the exit code. */
export async function runCli(options: CliOptions = {}): Promise<number> {
  const {
    args = process.argv.slice(2),
    connect = connectWithCliLogin,
    loadCatalog = buildCatalog,
    coverFile = coverFileFor,
    fileExists = exists,
    log = console.log,
    error = console.error,
  } = options;

  let mode: CliMode;
  try {
    mode = parseArgs(args);
  } catch {
    error(USAGE);
    return 1;
  }
  if (mode === 'help') {
    log(USAGE);
    return 0;
  }

  const catalog = loadCatalog();
  const ids = candidateIds(catalog);
  let connection: MigrationConnection;
  try {
    connection = await connect();
  } catch {
    error('Could not configure the Sanity client from sanity.cli.ts. Nothing was read or written.');
    return 1;
  }
  if (!connection.hasToken) {
    error(
      'No user token. Run `bunx sanity login`, then pass --with-user-token to `sanity exec`. Nothing was read or written.',
    );
    return 1;
  }
  log(
    `Bookshelf migration, ${mode}: project ${connection.projectId}, dataset ${connection.dataset}`,
  );

  const read = async (stage: Stage): Promise<ExistingDoc[]> => {
    const docs = await step(stage, async () =>
      asExistingDocs(await connection.fetchDocuments(ids)),
    );
    const ours = docs.filter((doc) => doc._type === 'book' || doc._type === 'bookshelf');
    log(
      `Read ${ours.filter((doc) => doc._type === 'book').length} book and ${ours.filter((doc) => doc._type === 'bookshelf').length} bookshelf documents (${ours.filter((doc) => !isPublishedId(doc._id)).length} drafts or versions).`,
    );
    return docs;
  };
  const verify = async (stage: Stage, expected?: DatasetStage): Promise<number> => {
    const result = verifyBookshelfState(await read(stage), catalog, expected);
    for (const line of describeVerification(result)) log(line);
    return result.failures.length > 0 ? 1 : 0;
  };
  const missingCovers = async (): Promise<string[]> => {
    const slugs = catalog.books.map((book) => book.slug);
    const found = await Promise.all(slugs.map((slug) => fileExists(coverFile(slug))));
    return slugs.filter((_, index) => !found[index]);
  };
  const uploadCovers = async (covers: readonly CoverUpload[]): Promise<Map<string, string>> => {
    if (covers.length === 0) return new Map();
    log(`Uploading ${covers.length} covers, ${UPLOAD_CONCURRENCY} at a time...`);
    const assetIds = await step('upload', () =>
      mapPool(covers, UPLOAD_CONCURRENCY, (cover) =>
        connection.uploadCover(cover.slug, coverFile(cover.slug)),
      ),
    );
    log(`Uploaded ${covers.length} covers.`);
    return new Map(covers.map((cover, index) => [cover.slug, assetIds[index] ?? '']));
  };
  const commit = async (mutations: readonly SanityMutation[]): Promise<void> => {
    await step('commit', () => connection.commit(mutations));
    log(`Committed ${mutations.length} mutations in one transaction.`);
  };

  try {
    switch (mode) {
      case 'verify':
        return await verify('read');

      case 'dry-run': {
        const plan = planBookshelfMigration(await read('read'), catalog, 'migrate');
        const missing = await missingCovers();
        for (const line of describePlan(plan, missing)) log(line);
        log('Dry run: nothing was written.');
        return plan.errors.length > 0 || missing.length > 0 ? 1 : 0;
      }

      case 'apply': {
        const plan = planBookshelfMigration(await read('read'), catalog, 'migrate');
        const missing = await missingCovers();
        for (const line of describePlan(plan, missing)) log(line);
        if (plan.errors.length > 0 || missing.length > 0) {
          error('Stopped before writing: fix the errors or missing cover files above.');
          return 1;
        }
        if (plan.creates.length === 0 && plan.patches.length === 0) {
          log('Nothing to write: the dataset already matches the catalog.');
        } else {
          await commit(buildMutations(plan, await uploadCovers(plan.coverUploads)));
        }
        return await verify('reread', 'migrated');
      }

      case 'finalize':
      case 'finalize-dry-run': {
        const docs = await read('read');
        const before = verifyBookshelfState(docs, catalog);
        if (before.failures.length > 0) {
          for (const line of describeVerification(before)) log(line);
          error('Stopped: the dataset does not pass --verify, so the legacy fields stay.');
          return 1;
        }
        const plan = planBookshelfMigration(docs, catalog, 'finalize');
        for (const line of describePlan(plan, [])) log(line);
        if (plan.errors.length > 0) {
          error('Stopped before writing: fix the errors above.');
          return 1;
        }
        if (mode === 'finalize-dry-run') {
          log('Dry run: nothing was written.');
          return 0;
        }
        if (plan.patches.length === 0) log('Nothing to finalize: no legacy field is left.');
        else await commit(buildMutations(plan, new Map()));
        return await verify('reread', 'finalized');
      }
    }
  } catch (cause) {
    error(
      cause instanceof StepError
        ? failureMessage(cause)
        : 'The migration stopped on an unexpected error. Run --verify to see the state of the dataset.',
    );
    return 1;
  }
}

/** True when this file is the script being run, not a module a test imported. */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  void runCli().then((code) => {
    process.exitCode = code;
  });
}
