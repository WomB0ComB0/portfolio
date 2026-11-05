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

import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/**
 * The repository path `specifier` names from `file`, without its extension or a trailing /index:
 * '@/' is src/, and a relative path resolves from the file's folder. Packages give undefined.
 */
const modulePathOf = (specifier: string, file: string): string | undefined => {
  const path = specifier.startsWith('@/')
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith('.')
      ? posix.join(posix.dirname(file), specifier)
      : undefined;
  return path?.replace(SOURCE_FILE, '').replace(/\/(?:index)?$/, '');
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

/** Where the rules' fixtures sit: six folders under src, like the stats page's interface. */
const FIXTURE_FILE = 'src/app/(routes)/(dev)/stats/_interface/stats/stats.tsx';
const UP_TO_SRC = '../../../../../..';

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
   * Which module `specifier` names, from `file` (see modulePathOf: an extension or a trailing
   * /index names the same module). Packages are 'other'.
   */
  const moduleKindOf = (specifier: string, file: string): ModuleKind => {
    const target = modulePathOf(specifier, file);
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

describe('no loading.tsx above a detail route', () => {
  /**
   * The app root, the route groups above the detail routes, and the folders that hold them. A list
   * page's skeleton goes in a route group beside its detail route, e.g. projects/(list)/loading.tsx.
   */
  const FOLDERS_ABOVE_DETAIL_ROUTES: ReadonlySet<string> = new Set([
    'src/app',
    'src/app/(routes)',
    'src/app/(routes)/(main)',
    'src/app/(routes)/(main)/(professioal)',
    'src/app/(routes)/(main)/(personal)',
    'src/app/(routes)/(main)/(professioal)/projects',
    'src/app/(routes)/(main)/(professioal)/experience',
    'src/app/(routes)/(main)/(personal)/places',
  ]);
  /** The detail routes those folders hold; the scan below expects to find them. */
  const DETAIL_PAGES = [
    'src/app/(routes)/(main)/(professioal)/projects/[id]/page.tsx',
    'src/app/(routes)/(main)/(professioal)/experience/[id]/page.tsx',
    'src/app/(routes)/(main)/(personal)/places/[placeId]/page.tsx',
  ] as const;
  const LOADING_FILE = /(?:^|\/)loading\.[cm]?[jt]sx?$/;
  const PAGE_FILE = /(?:^|\/)page\.[cm]?[jt]sx?$/;
  const DYNAMIC_SEGMENT = /^\[.+\]$/;
  const REASON = [
    'A loading.tsx wraps every page below its folder in a Suspense boundary. Above a detail route',
    '([param]) Next flushes that skeleton with HTTP 200 before the page calls notFound(), so an',
    'unknown id answers 200 instead of 404, and a failed load 200 instead of 500. Put a list',
    "page's skeleton in a route group beside the detail route, e.g. projects/(list)/loading.tsx.",
  ].join(' ');

  const hasDynamicSegment = (folder: string): boolean =>
    folder.split('/').some((segment) => DYNAMIC_SEGMENT.test(segment));

  /**
   * The loading files among `files` that sit above or inside a detail route: in one of the named
   * folders, in a folder with a [param] segment, or in any folder that holds a page under one.
   */
  const misplacedLoadingFiles = (files: readonly string[]): string[] => {
    const detailFolders = files
      .filter((file) => PAGE_FILE.test(file))
      .map((file) => posix.dirname(file))
      .filter(hasDynamicSegment);
    return files.filter((file) => {
      if (!LOADING_FILE.test(file)) return false;
      const folder = posix.dirname(file);
      return (
        FOLDERS_ABOVE_DETAIL_ROUTES.has(folder) ||
        hasDynamicSegment(folder) ||
        detailFolders.some((detail) => detail.startsWith(`${folder}/`))
      );
    });
  };

  it.each([
    'src/app/loading.tsx',
    'src/app/(routes)/loading.tsx',
    'src/app/(routes)/(main)/loading.tsx',
    'src/app/(routes)/(main)/(professioal)/loading.tsx',
    'src/app/(routes)/(main)/(personal)/loading.tsx',
    'src/app/(routes)/(main)/(professioal)/projects/loading.tsx',
    'src/app/(routes)/(main)/(professioal)/experience/loading.jsx',
    'src/app/(routes)/(main)/(personal)/places/loading.tsx',
    'src/app/(routes)/(main)/(professioal)/projects/[id]/loading.tsx',
    'src/app/(routes)/(main)/(personal)/places/[placeId]/loading.tsx',
    'src/app/(routes)/(main)/(personal)/places/[placeId]/_components/loading.tsx',
  ])('flags %s', (loading) => {
    expect(misplacedLoadingFiles([...DETAIL_PAGES, loading])).toEqual([loading]);
  });

  it('flags a loading.tsx above any new detail route, not only the named folders', () => {
    const loading = 'src/app/(routes)/(dev)/notes/loading.tsx';
    const files = [loading, 'src/app/(routes)/(dev)/notes/[slug]/page.tsx'];

    expect(misplacedLoadingFiles(files)).toEqual([loading]);
  });

  it.each([
    'src/app/(routes)/(main)/(professioal)/projects/(list)/loading.tsx',
    'src/app/(routes)/(main)/(professioal)/experience/(list)/loading.tsx',
    'src/app/(routes)/(main)/(personal)/places/(list)/loading.tsx',
    'src/app/(routes)/(main)/(professioal)/certifications/loading.tsx',
    'src/app/(routes)/(dev)/media/loading.tsx',
    'src/app/(routes)/(main)/(personal)/places/[placeId]/page.types.ts',
  ])('allows %s', (file) => {
    expect(misplacedLoadingFiles([...DETAIL_PAGES, file])).toEqual([]);
  });

  it('sees the detail routes, so the scan below reads the real tree', () => {
    expect(appSourceFiles()).toEqual(expect.arrayContaining([...DETAIL_PAGES]));
  });

  it('finds no loading file above or inside a detail route', () => {
    const offenders = misplacedLoadingFiles(appSourceFiles());

    expect(offenders, failureMessage(REASON, offenders)).toEqual([]);
  });
});

describe('no client data hooks deleted in D2', () => {
  /**
   * Modules D2 deleted, as repository paths with no extension. Pages render this data on the
   * server and hand it to client islands as props.
   */
  const DELETED_MODULES: ReadonlySet<string> = new Set([
    'src/hooks/sanity/use-sanity-suspense',
    'src/hooks/sanity/data-loaders',
    'src/hooks/sanity/config',
    'src/hooks/use-github-sponsors',
    'src/hooks/use-github-sponsors.types',
  ]);
  /**
   * The deleted hooks, whichever module they would come back through (the old pages imported the
   * Sanity ones from the '@/hooks' barrel): useDataLoader, the suspense hook removed from
   * effect-data-loader.tsx, and the useSanity* hooks built on it.
   */
  const DELETED_HOOK = /^(?:useDataLoader|useSanity[A-Z]\w*)$/;
  const REASON = [
    "Pages render their data on the server (Sanity through '@/lib/sanity/loaders') and pass it",
    'to client islands as props. The client hooks fetched it again in the browser after a server',
    'render without it. A live widget that polls an API route uses <DataLoader> or useQuery.',
  ].join(' ');

  /** The name a call expression calls: `useDataLoader(...)` or `anything.useDataLoader(...)`. */
  const calleeName = (node: ts.CallExpression): string | undefined => {
    const callee = node.expression;
    if (ts.isIdentifier(callee)) return callee.text;
    return ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
  };

  /** The deleted modules `source` imports or re-exports, and the deleted hooks it calls. */
  const deadHookUses: Finder = (source, file) =>
    allNodes(parse(source, file)).flatMap((node) => {
      const specifier = specifierOf(node);
      if (specifier !== undefined) {
        const target = modulePathOf(specifier, file);
        return target !== undefined && DELETED_MODULES.has(target) ? [specifier] : [];
      }
      const name = ts.isCallExpression(node) ? calleeName(node) : undefined;
      return name !== undefined && DELETED_HOOK.test(name) ? [name] : [];
    });

  it.each([
    "import { useSanityProjects } from '@/hooks/sanity/use-sanity-suspense';",
    "import * as hooks from '@/hooks/sanity/use-sanity-suspense.ts';",
    `import { useSanityPlaces } from '${UP_TO_SRC}/hooks/sanity/use-sanity-suspense';`,
    "export { useSanityResume } from '@/hooks/sanity/use-sanity-suspense';",
    "const hooks = await import('@/hooks/sanity/use-sanity-suspense');",
    "import { SanityDataLoader } from '@/hooks/sanity/data-loaders';",
    "import { createDataLoaderOptions } from '@/hooks/sanity/config';",
    "import { useGitHubSponsors } from '@/hooks/use-github-sponsors';",
    "const { data } = useDataLoader('/api/v1/sanity/projects');",
    'const { data } = useDataLoader<Project[]>(url, options);',
    'const query = loaders.useDataLoader(url);',
    'const { data: certifications } = useSanityCertifications();',
    'const { data } = hooks.useSanityPlaces();',
  ])('recognises %j', (source) => {
    expect(deadHookUses(source, FIXTURE_FILE)).not.toEqual([]);
  });

  it.each([
    'const card = <DataLoader url="/api/v1/lanyard">{() => null}</DataLoader>;',
    "import { DataLoader } from '@/providers/server/effect-data-loader';",
    "import type { Project } from '@/hooks/sanity/schemas';",
    "import { ProjectSchema } from '@/hooks/sanity';",
    "import { loadProjects } from '@/lib/sanity/loaders';",
    "const { data } = useQuery({ queryKey: ['lanyard'], queryFn });",
    '// const { data } = useDataLoader(url);',
    "const name = 'useDataLoader';",
    'useDataLoaderKey(props);',
    'useSanity();',
  ])('ignores %j', (source) => {
    expect(deadHookUses(source, FIXTURE_FILE)).toEqual([]);
  });

  it('finds no file under src/app that uses them', () => {
    const offenders = filesWith(deadHookUses);

    expect(offenders, failureMessage(REASON, offenders)).toEqual([]);
  });

  it('keeps the deleted modules deleted', () => {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const remaining = [...DELETED_MODULES].filter((module) =>
      extensions.some((extension) => existsSync(join(ROOT, `${module}${extension}`))),
    );

    expect(remaining, failureMessage(REASON, remaining)).toEqual([]);
  });
});
