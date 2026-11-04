// @vitest-environment node
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
 * @file Source guards for the Sentry wiring. The instrumentation hook must stay a plain module
 * (Next.js treats the exports of a file-level 'use server' module as Server Actions), and Sentry
 * helpers reach other code only through plain modules.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SOURCE_FILE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/;

/**
 * A file-level directive: the first statement, after any leading whitespace and comments.
 * A linear scan rather than one regex, which would backtrack on long runs of comments.
 */
function fileDirective(source: string): string | undefined {
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source.charAt(index))) {
      index += 1;
    } else if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index);
      if (end === -1) return undefined;
      index = end + 1;
    } else if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) return undefined;
      index = end + 2;
    } else {
      break;
    }
  }
  return /^['"](use (?:server|client))['"]/.exec(source.slice(index))?.[1];
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const srcFiles = (readdirSync(join(ROOT, 'src'), { recursive: true }) as string[])
  .filter((path) => SOURCE_FILE.test(path))
  .map((path) => join('src', path));

describe('src/instrumentation.ts', () => {
  const source = read('src/instrumentation.ts');

  it('has no directive', () => {
    expect(fileDirective(source)).toBeUndefined();
    expect(source).not.toMatch(/^\s*['"]use server['"]/m);
  });

  it("exports Sentry's request error hook", () => {
    expect(source).toMatch(/export const onRequestError = Sentry\.captureRequestError;/);
  });

  it('leaves the tracer provider to Sentry', () => {
    expect(source).not.toMatch(/from ['"]@vercel\/otel['"]|registerOTel\(/);
  });
});

describe('Sentry helpers in other modules', () => {
  it('detects file-level directives', () => {
    expect(fileDirective("'use server';\nexport const a = 1;")).toBe('use server');
    expect(fileDirective('/**\n * Licence\n */\n\n"use client";')).toBe('use client');
    expect(fileDirective("export const a = 1;\n'use server';")).toBeUndefined();
  });

  it("are never exported from a 'use server' file", () => {
    const offenders = srcFiles.filter((file) => {
      const source = read(file);
      return (
        fileDirective(source) === 'use server' &&
        /@sentry\/|@\/instrumentation|onRequestError|captureException/.test(source)
      );
    });
    expect(offenders).toEqual([]);
  });

  it('do not come from the instrumentation hook', () => {
    const importers = srcFiles.filter((file) =>
      /from ['"](?:@\/instrumentation|(?:\.\.?\/)+instrumentation)['"]/.test(read(file)),
    );
    expect(importers).toEqual([]);
  });

  it("are not re-exported through '@/core'", () => {
    expect(read('src/core/index.ts')).not.toMatch(/instrumentation|onRequestError|@sentry/);
  });

  it('scans a meaningful number of files (the walker found the source tree)', () => {
    expect(srcFiles.length).toBeGreaterThan(100);
  });
});
