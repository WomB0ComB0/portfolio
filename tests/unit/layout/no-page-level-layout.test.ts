// @vitest-environment node
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
 * @file Structural guards over the source under src/app, read as text. Each rule is one describe
 * block: a pattern, the files allowed to match it, and why the rest may not.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROOT = process.cwd();
const APP_DIR = 'src/app';
const SOURCE_FILE = /\.tsx?$/;

/** Every .ts/.tsx file under src/app, as a repository-relative path with forward slashes. */
const appSourceFiles = (): readonly string[] =>
  (readdirSync(join(ROOT, APP_DIR), { recursive: true }) as string[])
    .filter((file) => SOURCE_FILE.test(file))
    .map((file) => `${APP_DIR}/${file.split(sep).join('/')}`)
    .sort();

/** The files under src/app whose source matches `pattern`, leaving out the `allowed` ones. */
const filesMatching = (pattern: RegExp, allowed: ReadonlySet<string> = new Set()): string[] =>
  appSourceFiles().filter(
    (file) => !allowed.has(file) && pattern.test(readFileSync(join(ROOT, file), 'utf8')),
  );

const failureMessage = (reason: string, offenders: readonly string[]): string =>
  [reason, 'Offending files:', ...offenders.map((file) => `  ${file}`)].join('\n');

describe('no page-level Layout', () => {
  /** An import of the shell's Layout, by default or by name, from its module or a barrel. */
  const LAYOUT_IMPORT =
    /import\s+(?:Layout|\{[^}]*\bLayout\b[^}]*\})\s+from\s+'@\/components(?:\/layout(?:\/layout)?)?'/;
  /** The route-group shell, and the root 404, which Next renders outside route-group layouts. */
  const SHELL_OWNERS: ReadonlySet<string> = new Set([
    'src/app/(routes)/layout.tsx',
    'src/app/not-found.tsx',
  ]);
  const REASON =
    'Pages render inside src/app/(routes)/layout.tsx; a page-level <Layout> renders a second nav and a second <main>.';

  it.each([
    "import Layout from '@/components/layout/layout';",
    "import { Layout } from '@/components/layout/layout';",
    "import { Layout } from '@/components/layout';",
    "import { MagicCard, Layout } from '@/components';",
    "import {\n  Layout,\n  PageHeader,\n} from '@/components';",
  ])('recognises the Layout import %j', (source) => {
    expect(LAYOUT_IMPORT.test(source)).toBe(true);
  });

  it.each([
    "import { ErrorLayout } from '@/components';",
    "import { LayoutTextFlip } from '@/components/ui/layout-text-flip';",
    "import { LayoutTextFlip } from '@/components';",
    "import { Footer } from '@/components/layout/footer';",
    "import { PageHeader } from '@/components';",
    "import RootLayout from '@/app/layout';",
  ])('ignores the import %j', (source) => {
    expect(LAYOUT_IMPORT.test(source)).toBe(false);
  });

  it("sees the shell owners' own Layout imports, so the scan below reads the real tree", () => {
    expect(filesMatching(LAYOUT_IMPORT)).toEqual(expect.arrayContaining([...SHELL_OWNERS]));
  });

  it('finds no other file under src/app that imports Layout', () => {
    const offenders = filesMatching(LAYOUT_IMPORT, SHELL_OWNERS);

    expect(offenders, failureMessage(REASON, offenders)).toEqual([]);
  });
});
