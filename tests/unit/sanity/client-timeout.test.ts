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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERVER_SANITY_MAX_RETRIES,
  SERVER_SANITY_REQUEST_LIMITS,
  SERVER_SANITY_TIMEOUT_MS,
  sanityRequestLimits,
} from '@/lib/sanity/server-timeouts';

/** The browser's request timeout for /api/v1 calls (effect-fetcher get(..., { timeout })). */
const BROWSER_TIMEOUT_MS = 10_000;

/** The argument text of every `createClient(...)` call in `source`, parentheses balanced. */
const createClientCalls = (source: string): string[] => {
  const calls: string[] = [];
  const opener = 'createClient(';
  let start = source.indexOf(opener);
  while (start !== -1) {
    let depth = 1;
    let end = start + opener.length;
    while (depth > 0 && end < source.length) {
      if (source[end] === '(') depth += 1;
      if (source[end] === ')') depth -= 1;
      end += 1;
    }
    calls.push(source.slice(start + opener.length, end - 1));
    start = source.indexOf(opener, end);
  }
  return calls;
};

describe('server Sanity request limits', () => {
  it('give up on a hanging Sanity before the browser does, so the stale-or-503 path can answer', () => {
    const worstCase = SERVER_SANITY_TIMEOUT_MS * (SERVER_SANITY_MAX_RETRIES + 1);

    expect(worstCase).toBeLessThan(BROWSER_TIMEOUT_MS);
    expect(SERVER_SANITY_REQUEST_LIMITS).toEqual({
      timeout: SERVER_SANITY_TIMEOUT_MS,
      maxRetries: SERVER_SANITY_MAX_RETRIES,
    });
  });

  it('apply on the server and leave the browser client on its defaults', () => {
    expect(sanityRequestLimits(false)).toEqual(SERVER_SANITY_REQUEST_LIMITS);
    expect(sanityRequestLimits(true)).toEqual({});
  });

  it('are given to every client, so a server without SANITY_API_TOKEN gets them too', () => {
    // client.ts can't be imported in tests (it require()s '@/env' at load), so check its source.
    const source = readFileSync(join(process.cwd(), 'src/lib/sanity/client.ts'), 'utf8');
    const calls = createClientCalls(source.replaceAll(/\/\/.*$/gm, ''));

    // The public client (the server's fallback without a token) and the token client.
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call).toContain('...requestLimits');
    expect(source).toContain('const requestLimits = sanityRequestLimits(isBrowser);');
    expect(source).toMatch(/config\.token\s*\?\s*createClient\(/);
    expect(source).toMatch(/:\s*sanityClient;/);
  });
});
