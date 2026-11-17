/**
 * Copyright 2025 Mike Odnis
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

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@sanity/client';
import { HEALTH_DOCUMENT_QUERY } from '../../src/lib/link-health/documents';
import { probeLink } from '../../src/lib/link-health/probe';
import {
  runScheduledChecks,
  ScheduledCheckError,
  type ScheduledDependencies,
} from '../../src/lib/link-health/scheduled';
import { fetchPublishedCatalog } from './catalog';

/** Only CI reads the write token. This module never imports the app's complete environment schema. */
type CheckerEnvironment = Readonly<Record<string, string | undefined>>;

function connectDependencies(env: CheckerEnvironment, dryRun: boolean): ScheduledDependencies {
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const token = env.SANITY_LINK_HEALTH_TOKEN;
  if (
    !projectId ||
    !/^[a-z0-9-]{1,64}$/iu.test(projectId) ||
    (!dryRun && !token) ||
    (env.NEXT_PUBLIC_SANITY_DATASET && env.NEXT_PUBLIC_SANITY_DATASET !== 'production')
  )
    throw new Error('Invalid checker configuration');
  const client = createClient({
    projectId,
    dataset: 'production',
    token,
    apiVersion: '2024-10-14',
    useCdn: false,
    perspective: 'published',
    timeout: 10_000,
    maxRetries: 0,
  });
  return {
    catalog: (scope) => fetchPublishedCatalog(scope),
    readDocuments: (ids) =>
      client.fetch(HEALTH_DOCUMENT_QUERY, { ids }, { signal: AbortSignal.timeout(10_000) }),
    probe: probeLink,
    write: (mutations) => client.mutate(mutations, { visibility: 'sync', returnDocuments: false }),
  };
}

interface CliOptions {
  args?: readonly string[];
  env?: CheckerEnvironment;
  createDependencies?: (env: CheckerEnvironment, dryRun: boolean) => ScheduledDependencies;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

/** Logs only fixed messages and aggregate counts, never SDK errors/configuration or target URLs. */
export async function runCli({
  args = process.argv.slice(2),
  env = process.env,
  createDependencies = connectDependencies,
  log = console.log,
  error = console.error,
}: CliOptions = {}): Promise<number> {
  try {
    if (args.some((arg) => arg !== '--dry-run' && arg !== '--help'))
      throw new Error('Invalid arguments');
    if (args.includes('--help')) {
      log(
        'Usage: node --conditions=react-server --import=tsx scripts/link-health/check.ts [--dry-run]',
      );
      return 0;
    }
    const dryRun = args.includes('--dry-run');
    const dependencies = createDependencies(env, dryRun);
    log(JSON.stringify(await runScheduledChecks(dependencies, { dryRun })));
    return 0;
  } catch (cause) {
    const stage = cause instanceof ScheduledCheckError ? cause.stage : 'configuration';
    error(`Scheduled link check failed: ${stage}. No records were deleted.`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  void runCli().then((code) => {
    process.exitCode = code;
  });
