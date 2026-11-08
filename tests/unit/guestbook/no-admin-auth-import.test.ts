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
 * @file Guards for the guestbook's sign-in check, after #616 took down every /api/v1 route.
 *
 * Next keeps firebase-admin outside the bundle and loads it at runtime. Its auth entry needs
 * jwks-rsa, which require()s jose, an ES module; a Node without require(esm) cannot load it, and
 * since the whole /api/v1 app (and /stats) shares one module with firebase-admin, every route
 * answered 500. Firestore (firebase-admin/app and /firestore) loads fine, so it stays.
 *
 * - No source file may name firebase-admin/auth (import, require or dynamic import): tokens are
 *   verified with jose (src/core/firebase-id-token.ts).
 * - jose must be bundled into the route, not left to a runtime require: it must not be in Next's
 *   built-in list of external server packages, nor in this app's serverExternalPackages.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROOT = process.cwd();
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const ROOT_FILES = [
  'instrumentation-client.ts',
  'instrumentation-edge.ts',
  'instrumentation-server.ts',
  'next.config.ts',
];

/** firebase-admin/auth (or a path under it) as a quoted module specifier. */
const ADMIN_AUTH_SPECIFIER = /['"`]firebase-admin\/auth(?:\/[^'"`]*)?['"`]/;

/** Every source file under src, plus the root files Next loads, as repository-relative paths. */
const sourceFiles = (): readonly string[] => [
  ...(readdirSync(join(ROOT, 'src'), { recursive: true }) as string[])
    .filter((file) => SOURCE_FILE.test(file))
    .map((file) => `src/${file.split(sep).join('/')}`),
  ...ROOT_FILES,
];

const readSource = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

describe('firebase-admin/auth stays out of the app', () => {
  it('is not imported, required or dynamically imported by any source file', () => {
    const offenders = sourceFiles().filter((file) => ADMIN_AUTH_SPECIFIER.test(readSource(file)));

    expect(offenders).toEqual([]);
  });

  it('finds the specifier however it is quoted (the guard itself works)', () => {
    expect(ADMIN_AUTH_SPECIFIER.test("import { getAuth } from 'firebase-admin/auth';")).toBe(true);
    expect(ADMIN_AUTH_SPECIFIER.test('await import("firebase-admin/auth")')).toBe(true);
    expect(ADMIN_AUTH_SPECIFIER.test("from 'firebase-admin/firestore'")).toBe(false);
  });
});

describe('jose is bundled, not loaded at runtime', () => {
  it("is not in Next's built-in list of external server packages", () => {
    const requireFromRoot = createRequire(join(ROOT, 'package.json'));
    const nextDir = dirname(requireFromRoot.resolve('next/package.json'));
    const builtIn = readFileSync(join(nextDir, 'dist/lib/server-external-packages.jsonc'), 'utf8');

    // The list is the one that externalises firebase-admin, so it is the right file.
    expect(builtIn).toContain('"firebase-admin"');
    expect(builtIn).not.toContain('"jose"');
  });

  it("is not in this app's serverExternalPackages", () => {
    const config = readSource('next.config.ts');
    const externals = /serverExternalPackages\s*:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';

    expect(externals).not.toMatch(/['"]jose['"]/);
  });
});
