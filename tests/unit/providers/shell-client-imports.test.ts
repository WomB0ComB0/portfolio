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
 * @file Modules that every route loads in the browser stay off the heavy libraries they only
 * reached by accident. Each was measured in a production build (gzip -9 of the first-load JS that
 * all 16 audited routes share):
 * - the QueryClient (src/providers/server/query-client.ts, loaded by the GlobalProvider) needs
 *   ValidationError only for an instanceof check. Importing it from effect-fetcher brought the
 *   whole effect package, about 60 KB, into every route; it imports the effect-free
 *   validation-error module instead, which effect-fetcher re-exports.
 * - the Sentry browser entry (instrumentation-client.ts) and the GA4 tag (analytics-scripts.tsx)
 *   read their NEXT_PUBLIC_ variables with literal process.env reads, which Next inlines. Going
 *   through '@/config' or '@/env' loaded src/env.ts, t3-env and zod (about 28 KB) ahead of
 *   hydration, only to re-check variables the build has already validated.
 * - the GlobalProvider sets zod's jitless option through zod's core config, which is the function
 *   z.config is; importing `z` from 'zod' for that one call loaded the whole library.
 *
 * Type-only imports are fine, because they are erased before bundling.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({ env: {}, default: {} }));

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROOT = process.cwd();

/** Whether an import loads its module: anything but `import type` or all-`type` named imports. */
const isValueImport = (node: ts.ImportDeclaration): boolean => {
  const clause = node.importClause;
  if (clause === undefined) return true;
  if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return false;
  const bindings = clause.namedBindings;
  if (clause.name !== undefined || bindings === undefined || ts.isNamespaceImport(bindings)) {
    return true;
  }
  return bindings.elements.length === 0 || bindings.elements.some((element) => !element.isTypeOnly);
};

/** The specifiers a repository file loads at runtime: value imports and export-froms. */
const valueSpecifiers = (file: string): string[] => {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
  return parsed.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement) && isValueImport(statement)) {
      return [(statement.moduleSpecifier as ts.StringLiteral).text];
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.moduleSpecifier) {
      return [(statement.moduleSpecifier as ts.StringLiteral).text];
    }
    return [];
  });
};

const isPackage = (specifier: string, name: string): boolean =>
  specifier === name || specifier.startsWith(`${name}/`);

describe('the QueryClient every route loads', () => {
  const QUERY_CLIENT = 'src/providers/server/query-client.ts';

  it('loads neither effect nor effect-fetcher', () => {
    const specifiers = valueSpecifiers(QUERY_CLIENT);
    expect(specifiers.filter((specifier) => isPackage(specifier, 'effect'))).toEqual([]);
    expect(specifiers).not.toContain('@/lib/http-clients/effect-fetcher');
    expect(specifiers).not.toContain('@/lib/http-clients');
    expect(specifiers).toContain('@/lib/http-clients/validation-error');
  });

  it('recognises the ValidationError effect-fetcher throws, which is the same class', async () => {
    expect(valueSpecifiers('src/lib/http-clients/validation-error.ts')).toEqual([]);
    const fromFetcher = await import('@/lib/http-clients/effect-fetcher');
    const fromModule = await import('@/lib/http-clients/validation-error');
    expect(fromFetcher.ValidationError).toBe(fromModule.ValidationError);
  });
});

describe('the Sentry browser entry and the GA4 tag', () => {
  it.each(['instrumentation-client.ts', 'src/components/scripts/analytics-scripts.tsx'])(
    '%s loads neither src/env.ts nor zod',
    (file) => {
      const specifiers = valueSpecifiers(file);
      const heavy = specifiers.filter(
        (specifier) =>
          specifier === '@/env' ||
          specifier === '@/config' ||
          isPackage(specifier, 'zod') ||
          isPackage(specifier, '@t3-oss/env-nextjs'),
      );
      expect(heavy).toEqual([]);
    },
  );
});

describe('the GlobalProvider', () => {
  it("sets zod's jitless option from zod's core, without loading the zod library", () => {
    const zodImports = valueSpecifiers('src/app/_providers/global-provider.tsx').filter(
      (specifier) => isPackage(specifier, 'zod'),
    );
    expect(zodImports).toEqual(['zod/v4/core']);
  });

  it('calls the config that z.config is, so the setting reaches every zod schema', async () => {
    const { z } = await import('zod');
    const core = await import('zod/v4/core');
    expect(core.config).toBe(z.config);
  });
});
