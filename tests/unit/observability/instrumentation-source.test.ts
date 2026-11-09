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

const isWhitespace = (char: string) => char.trim() === '';
const isLineBreak = (char: string) => char === '\n' || char === '\r';
/**
 * Any ECMAScript LineTerminator. U+2028/2029 are legal inside string literals, so stringLiteralEnd
 * keeps isLineBreak.
 */
const isLineTerminator = (char: string) =>
  isLineBreak(char) || char === '\u2028' || char === '\u2029';

/**
 * First index at or after `start` that is not whitespace or a comment; -1 if a comment is open.
 * A line comment ends at any line terminator (LF, CR, U+2028 or U+2029).
 */
function skipTrivia(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    if (isWhitespace(source.charAt(index))) {
      index += 1;
    } else if (source.startsWith('//', index)) {
      let end = index + 2;
      while (end < source.length && !isLineTerminator(source.charAt(end))) end += 1;
      if (end === source.length) return source.length;
      index = end + 1;
    } else if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) return -1;
      index = end + 2;
    } else {
      break;
    }
  }
  return index;
}

/**
 * Index just past the string literal that opens at `start`, or -1 if it is not closed. A backslash
 * before CRLF is one line continuation.
 */
function stringLiteralEnd(source: string, start: number): number {
  const quote = source.charAt(start);
  let index = start + 1;
  while (index < source.length) {
    const char = source.charAt(index);
    if (char === quote) return index + 1;
    if (isLineBreak(char)) return -1;
    if (char !== '\\') {
      index += 1;
    } else {
      index += source.startsWith('\r\n', index + 1) ? 3 : 2;
    }
  }
  return -1;
}

/**
 * Where the next statement may start after a string literal that ends at `start`, or -1 when the
 * literal is part of a longer expression. The literal is a whole statement when `;`, a line
 * terminator (LF, CR, U+2028, U+2029; a line comment or a block comment spanning lines counts) or
 * the end of the file follows.
 */
function directiveEnd(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    const char = source.charAt(index);
    if (char === ';' || isLineTerminator(char)) return index + 1;
    if (isWhitespace(char)) {
      index += 1;
    } else if (source.startsWith('//', index)) {
      return index;
    } else if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2);
      if (close === -1) return -1;
      const comment = source.slice(index + 2, close);
      if ([...comment].some(isLineTerminator)) return close + 2;
      index = close + 2;
    } else {
      return -1;
    }
  }
  return index;
}

/**
 * The file's directive prologue, in order: each statement that is only a string literal, before
 * the first other statement, skipping whitespace and comments. 'use strict' followed by
 * 'use server' gives both. Every character is visited a bounded number of times (a linear scan,
 * not a regex that could backtrack on long runs of comments).
 */
function directivePrologue(source: string): string[] {
  const directives: string[] = [];
  let index = skipTrivia(source, 0);
  while (index >= 0 && index < source.length) {
    const quote = source.charAt(index);
    if (quote !== "'" && quote !== '"') break;
    const end = stringLiteralEnd(source, index);
    const next = end === -1 ? -1 : directiveEnd(source, end);
    if (next === -1) break;
    directives.push(source.slice(index + 1, end - 1));
    index = skipTrivia(source, next);
  }
  return directives;
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const srcFiles = (readdirSync(join(ROOT, 'src'), { recursive: true }) as string[])
  .filter((path) => SOURCE_FILE.test(path))
  .map((path) => join('src', path));

describe('src/instrumentation.ts', () => {
  const source = read('src/instrumentation.ts');

  it('has no directive', () => {
    expect(directivePrologue(source)).toEqual([]);
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
    expect(directivePrologue("'use server';\nexport const a = 1;")).toEqual(['use server']);
    expect(directivePrologue('/**\n * Licence\n */\n\n"use client";')).toEqual(['use client']);
    expect(directivePrologue("'use server'")).toEqual(['use server']);
    expect(directivePrologue("export const a = 1;\n'use server';")).toEqual([]);
  });

  it("reads the whole prologue, so 'use server' after 'use strict' still counts", () => {
    expect(directivePrologue("'use strict';\n'use server';\nexport const a = 1;")).toEqual([
      'use strict',
      'use server',
    ]);
    expect(
      directivePrologue('// a\n"use strict" // b\n/* c\n */ \'use client\'\nexport {};'),
    ).toEqual(['use strict', 'use client']);
    expect(directivePrologue("'use strict'; /* c */ 'use server';")).toEqual([
      'use strict',
      'use server',
    ]);
  });

  it('ends a statement or a comment at any line terminator outside a string', () => {
    expect(directivePrologue("'use strict'\u2028'use server';")).toEqual([
      'use strict',
      'use server',
    ]);
    expect(directivePrologue("'use strict'\u2029'use server';")).toEqual([
      'use strict',
      'use server',
    ]);
    expect(directivePrologue("// licence\r'use server';\nexport const a = 1;")).toEqual([
      'use server',
    ]);
    expect(directivePrologue("// licence\u2028'use server';")).toEqual(['use server']);
    expect(directivePrologue("'use strict' /*\u2029*/ 'use server';")).toEqual([
      'use strict',
      'use server',
    ]);
    expect(directivePrologue("// licence\r\n'use server';")).toEqual(['use server']);
    expect(directivePrologue('// only a comment')).toEqual([]);
  });

  it('keeps U+2028 and U+2029 inside a string literal, where they are legal', () => {
    expect(directivePrologue("'a\u2028b';\n'use server';")).toEqual(['a\u2028b', 'use server']);
    expect(directivePrologue("'a\u2029b';\n'use server';")).toEqual(['a\u2029b', 'use server']);
  });

  it('skips a backslash before CRLF as one line continuation', () => {
    expect(directivePrologue("'a\\\r\nb';\n'use server';")).toEqual(['a\\\r\nb', 'use server']);
    expect(directivePrologue("'a\\\nb';\n'use server';")).toEqual(['a\\\nb', 'use server']);
    expect(directivePrologue("'a\\\\';\n'use server';")).toEqual(['a\\\\', 'use server']);
  });

  it('stops at the first statement that is not a lone string literal', () => {
    expect(directivePrologue("'use strict'.length;\n'use server';")).toEqual([]);
    expect(directivePrologue("'use strict';\nimport a from 'a';\n'use server';")).toEqual([
      'use strict',
    ]);
    expect(directivePrologue("'use strict' + 'use server';")).toEqual([]);
    expect(directivePrologue("'use strict' /* c */ 'use server';")).toEqual([]);
    expect(directivePrologue("'use server")).toEqual([]);
    expect(directivePrologue('/* unterminated')).toEqual([]);
  });

  it("are never exported from a 'use server' file", () => {
    const offenders = srcFiles.filter((file) => {
      const source = read(file);
      return (
        directivePrologue(source).includes('use server') &&
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
