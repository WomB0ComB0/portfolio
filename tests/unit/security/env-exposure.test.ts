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
 * @file Guards against shipping credentials to the browser.
 *
 * Next.js inlines the value of every `NEXT_PUBLIC_*` variable that code references into the
 * client bundles, so a secret with that prefix is public. The Upstash Redis REST token and the
 * Hashnode personal access token both leaked this way.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives); under jsdom
// import.meta.url is not a file: URL, so resolve from the working directory instead.
const ROOT = process.cwd();
const SECRET_LIKE = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL)[A-Z0-9_]*/g;
const SOURCE_FILE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/;

/** Returns the text between `<label>: {` and its matching closing brace. */
function block(source: string, label: string): string {
  const start = source.indexOf(`${label}: {`);
  if (start < 0) throw new Error(`no "${label}" block in src/env.ts`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated "${label}" block in src/env.ts`);
}

function bundledSourceFiles(): string[] {
  const inSrc = (readdirSync(join(ROOT, 'src'), { recursive: true }) as string[])
    .filter((p) => SOURCE_FILE.test(p))
    .map((p) => join('src', p));
  const rootFiles = readdirSync(ROOT).filter((p) =>
    /^(?:next\.config|instrumentation[\w-]*)\.[cm]?ts$/.test(p),
  );
  return [...inSrc, ...rootFiles];
}

describe('environment variable exposure', () => {
  const envSource = readFileSync(join(ROOT, 'src/env.ts'), 'utf8');

  it('declares no secret-looking client (NEXT_PUBLIC_) variables in src/env.ts', () => {
    expect(block(envSource, 'client').match(SECRET_LIKE) ?? []).toEqual([]);
  });

  it('keeps the Upstash Redis credentials server-only', () => {
    const server = block(envSource, 'server');
    expect(server).toContain('UPSTASH_REDIS_REST_URL:');
    expect(server).toContain('UPSTASH_REDIS_REST_TOKEN:');
    expect(envSource).not.toContain('NEXT_PUBLIC_UPSTASH_');
  });

  it('references no secret-looking NEXT_PUBLIC_ variable anywhere in bundled code', () => {
    const offenders = bundledSourceFiles().flatMap((file) => {
      const hits = readFileSync(join(ROOT, file), 'utf8').match(SECRET_LIKE) ?? [];
      return [...new Set(hits)].map((name) => `${file}: ${name}`);
    });
    expect(offenders).toEqual([]);
  });

  it('scans a meaningful number of files (the walker found the source tree)', () => {
    expect(bundledSourceFiles().length).toBeGreaterThan(100);
  });
});
