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

// @vitest-environment node

/**
 * @file The reporter drops a timeout that came due while the process was paused only if the error
 * says it is a timeout (see isTimeout). A FetcherError built with a timeout message but without
 * the marker would slip back into Sentry after every freeze, so the source must build those as
 * FetcherTimeoutError.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../../src');
const SOURCE_FILE = /\.(?:ts|tsx)$/;

const sources = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((path) => SOURCE_FILE.test(path))
  .map((path) => ({ path, text: readFileSync(join(SRC, path), 'utf8') }));

/** `new FetcherError(` whose message (the first argument, a literal) speaks of a timeout. */
const UNMARKED_TIMEOUT = /new FetcherError\(\s*[`'"][^`'"]*(?:timed out|did not answer)/gi;

describe('timeout errors in src', () => {
  it('scans the source tree', () => {
    expect(sources.length).toBeGreaterThan(200);
  });

  it('builds every FetcherError that reports a timeout as a FetcherTimeoutError', () => {
    const unmarked = sources.flatMap(({ path, text }) =>
      [...text.matchAll(UNMARKED_TIMEOUT)].map((match) => `${path}: ${match[0]}`),
    );
    expect(unmarked).toEqual([]);
  });

  it('finds the marked timeouts it is guarding (the fetcher and the upstream deadlines)', () => {
    const marked = sources.filter(({ text }) => text.includes('new FetcherTimeoutError('));
    expect(marked.length).toBeGreaterThanOrEqual(8);
  });
});
