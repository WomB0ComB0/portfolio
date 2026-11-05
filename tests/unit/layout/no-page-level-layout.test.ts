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
 * @file Structural guards over the source under src/app, parsed with the TypeScript compiler. Each
 * rule is one describe block: what it looks for, the files allowed to have it, and why the rest
 * may not.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROOT = process.cwd();
const APP_DIR = 'src/app';
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/** Every source file under src/app, as a repository-relative path with forward slashes. */
const appSourceFiles = (): readonly string[] =>
  (readdirSync(join(ROOT, APP_DIR), { recursive: true }) as string[])
    .filter((file) => SOURCE_FILE.test(file))
    .map((file) => `${APP_DIR}/${file.split(sep).join('/')}`)
    .sort();

/** What a rule finds in one file's source, e.g. the specifiers of its offending imports. */
type Finder = (source: string, file: string) => readonly string[];

/** The files under src/app where `find` finds something, leaving out the `allowed` ones. */
const filesWith = (find: Finder, allowed: ReadonlySet<string> = new Set()): string[] =>
  appSourceFiles().filter(
    (file) => !allowed.has(file) && find(readFileSync(join(ROOT, file), 'utf8'), file).length > 0,
  );

const failureMessage = (reason: string, offenders: readonly string[]): string =>
  [reason, 'Offending files:', ...offenders.map((file) => `  ${file}`)].join('\n');

/** Parses `source` as the file it came from: JSX only in .tsx and .jsx files. */
const parse = (source: string, file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    false,
    /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

/** Every node of `root`, depth first. */
const allNodes = (root: ts.Node): ts.Node[] => {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return nodes;
};

describe('no page-level Layout', () => {
  /** The shell's own module and the layout barrel, as repository paths with no extension. */
  const SHELL_MODULES: ReadonlySet<string> = new Set([
    'src/components/layout/layout',
    'src/components/layout',
  ]);
  /** The root barrel re-exports the layout barrel, so the shell can come through it too. */
  const ROOT_BARREL = 'src/components';
  const SHELL_EXPORT = 'Layout';
  /** The route-group shell, and the root 404, which Next renders outside route-group layouts. */
  const SHELL_OWNERS: ReadonlySet<string> = new Set([
    'src/app/(routes)/layout.tsx',
    'src/app/not-found.tsx',
  ]);
  const REASON =
    'Pages render inside src/app/(routes)/layout.tsx; a page-level <Layout> renders a second nav and a second <main>.';

  type ModuleKind = 'shell' | 'root-barrel' | 'other';

  /**
   * Which module `specifier` names, from `file`: '@/' is src/, a relative path resolves from the
   * file's folder, and an extension or a trailing /index names the same module. Packages are
   * 'other'.
   */
  const moduleKindOf = (specifier: string, file: string): ModuleKind => {
    const path = specifier.startsWith('@/')
      ? `src/${specifier.slice(2)}`
      : specifier.startsWith('.')
        ? posix.join(posix.dirname(file), specifier)
        : undefined;
    const target = path?.replace(SOURCE_FILE, '').replace(/\/(?:index)?$/, '');
    if (target !== undefined && SHELL_MODULES.has(target)) return 'shell';
    return target === ROOT_BARREL ? 'root-barrel' : 'other';
  };

  /** Whether a named import or export brings in Layout as a value, under any local name. */
  const namesLayout = (elements: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[]): boolean =>
    elements.some(
      (element) =>
        !element.isTypeOnly && (element.propertyName ?? element.name).text === SHELL_EXPORT,
    );

  /** Whether an import of the shell, or of the root barrel, brings the shell in as a value. */
  const importBringsShell = (node: ts.ImportDeclaration, kind: ModuleKind): boolean => {
    const clause = node.importClause;
    if (clause === undefined) return kind === 'shell';
    if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return false;
    const bindings = clause.namedBindings;
    if (bindings !== undefined && ts.isNamespaceImport(bindings)) return true;
    const named = bindings === undefined ? [] : bindings.elements;
    if (kind === 'root-barrel') return namesLayout(named);
    return clause.name !== undefined || named.length === 0 || named.some((el) => !el.isTypeOnly);
  };

  /** Whether an export-from of the shell, or of the root barrel, passes the shell on as a value. */
  const exportBringsShell = (node: ts.ExportDeclaration, kind: ModuleKind): boolean => {
    if (node.isTypeOnly) return false;
    const clause = node.exportClause;
    if (clause === undefined || ts.isNamespaceExport(clause)) return true;
    return kind === 'root-barrel'
      ? namesLayout(clause.elements)
      : clause.elements.some((element) => !element.isTypeOnly);
  };

  /** The module specifier of `node` if it imports, exports from or dynamically imports one. */
  const specifierOf = (node: ts.Node): string | undefined => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      return specifier !== undefined && ts.isStringLiteral(specifier) ? specifier.text : undefined;
    }
    if (!ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
      return undefined;
    }
    const [argument] = node.arguments;
    return argument !== undefined && ts.isStringLiteralLike(argument) ? argument.text : undefined;
  };

  /** Whether `node`, which names a shell module or the root barrel, brings the shell in. */
  const bringsShell = (node: ts.Node, kind: ModuleKind): boolean => {
    if (ts.isImportDeclaration(node)) return importBringsShell(node, kind);
    if (ts.isExportDeclaration(node)) return exportBringsShell(node, kind);
    // A dynamic import() returns the whole module, whichever export the caller picks from it.
    return true;
  };

  /**
   * The specifiers through which `source` brings in the shell: any static import, export-from or
   * dynamic import() of the shell module or the layout barrel, whatever the binding is called, or
   * a Layout binding, namespace import or dynamic import of the root barrel. Type-only imports
   * are left out: they do not render anything.
   */
  const shellImports: Finder = (source, file) =>
    allNodes(parse(source, file)).flatMap((node) => {
      const specifier = specifierOf(node);
      if (specifier === undefined) return [];
      const kind = moduleKindOf(specifier, file);
      return kind !== 'other' && bringsShell(node, kind) ? [specifier] : [];
    });

  /** Where the fixtures below sit: six folders under src, like the stats page's interface. */
  const FIXTURE_FILE = 'src/app/(routes)/(dev)/stats/_interface/stats/stats.tsx';
  const UP_TO_SRC = '../../../../../..';

  it.each([
    "import Layout from '@/components/layout/layout';",
    "import { Layout } from '@/components/layout/layout';",
    "import { Layout } from '@/components/layout';",
    "import { MagicCard, Layout } from '@/components';",
    "import {\n  Layout,\n  PageHeader,\n} from '@/components';",
    // A renamed binding is still the shell.
    "import Shell from '@/components/layout/layout';",
    "import { Layout as Shell } from '@/components/layout/layout';",
    "import { Layout as Frame } from '@/components';",
    "import Layout, { type LayoutProps } from '@/components/layout/layout';",
    // The layout barrel evaluates the shell's module, whichever export is picked.
    "import { Footer } from '@/components/layout';",
    "import * as Shell from '@/components/layout';",
    "import * as Components from '@/components';",
    "import '@/components/layout/layout';",
    'import Shell from "@/components/layout/layout";',
    // Every path to the same module.
    "import { Layout } from '@/components/layout/index';",
    "import { Layout } from '@/components/layout/layout.tsx';",
    `import { Layout } from '${UP_TO_SRC}/components/layout/layout';`,
    `import { Layout } from '${UP_TO_SRC}/components/layout';`,
    `import { Layout as Frame } from '${UP_TO_SRC}/components';`,
    // Dynamic imports and re-exports.
    "const Shell = dynamic(() => import('@/components/layout/layout').then((m) => m.Layout));",
    'const shell = await import(`@/components/layout`);',
    "const components = await import('@/components');",
    "export { Layout } from '@/components/layout/layout';",
    "export { Layout as Shell } from '@/components';",
    "export * from '@/components/layout';",
    "export * as Shell from '@/components/layout/layout';",
  ])('recognises the shell import %j', (source) => {
    expect(shellImports(source, FIXTURE_FILE)).not.toEqual([]);
  });

  it.each([
    "import { ErrorLayout } from '@/components';",
    "import { LayoutTextFlip } from '@/components/ui/layout-text-flip';",
    "import { LayoutTextFlip } from '@/components';",
    "import { Footer } from '@/components/layout/footer';",
    "import { PageHeader } from '@/components';",
    "import RootLayout from '@/app/layout';",
    "import { Layout } from './_components/layout';",
    "import { Layout } from '../components/layout';",
    "import type { LayoutProps } from '@/components/layout/layout';",
    "import { type LayoutProps } from '@/components/layout';",
    "import type { Layout } from '@/components';",
    "export type { LayoutProps } from '@/components/layout/layout';",
    "type Shell = typeof import('@/components/layout/layout');",
    "// import Layout from '@/components/layout/layout';",
    'const example = "import Layout from \'@/components/layout/layout\'";',
  ])('ignores the import %j', (source) => {
    expect(shellImports(source, FIXTURE_FILE)).toEqual([]);
  });

  it("sees the shell owners' own Layout imports, so the scan below reads the real tree", () => {
    expect(filesWith(shellImports)).toEqual(expect.arrayContaining([...SHELL_OWNERS]));
  });

  it('finds no other file under src/app that imports the shell', () => {
    const offenders = filesWith(shellImports, SHELL_OWNERS);

    expect(offenders, failureMessage(REASON, offenders)).toEqual([]);
  });
});
