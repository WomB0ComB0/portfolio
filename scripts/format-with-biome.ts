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

/**
 * @file Formats the reports a script writes to scripts/out with the repository's Biome.
 *
 * `bun run lint` checks the tracked reports with `biome ci`. JSON.stringify(x, null, 2) puts every
 * array entry on its own line, while Biome joins an array that fits within the line width, so a
 * report written by JSON.stringify alone fails lint as soon as one of its arrays gets short enough.
 */

import { type SpawnSyncReturns, spawnSync } from 'node:child_process';

/** Why a Biome run failed: it could not start, was killed, or exited non-zero. */
const failureReason = (result: SpawnSyncReturns<string>): string => {
  if (result.error) return result.error.message;
  const exit = result.signal ? `was killed by ${result.signal}` : `exited with ${result.status}`;
  return `biome ${exit}\n${result.stderr.trim()}`;
};

/**
 * Runs `biome format --write` on `files` with the Biome installed in the repository; `bunx
 * --no-install` never downloads one. `root` is the repository root, where biome.json is.
 *
 * Fails softly: when Biome cannot run or rejects a file, it warns, leaves the files as written and
 * returns false, so a report is never lost over formatting. `bun run lint:fix` formats it later.
 */
export const formatWithBiome = (files: readonly string[], root: string): boolean => {
  if (files.length === 0) return true;
  const result = spawnSync('bunx', ['--no-install', 'biome', 'format', '--write', ...files], {
    cwd: root,
    encoding: 'utf8',
  });
  if (!result.error && result.status === 0) return true;
  console.warn(
    `⚠️  Could not format ${files.join(', ')} with Biome (run \`bun run lint:fix\`): ${failureReason(result)}`,
  );
  return false;
};
