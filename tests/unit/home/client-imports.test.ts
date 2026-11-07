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
 * @file The home page's client islands stay light, and server code stays on the server.
 *
 * Every module under src/app/_components/home whose directive prologue holds 'use client' is a
 * client entry, wherever the license header puts the directive. The guard parses each one with
 * the TypeScript compiler and follows its value imports of other modules in the home folder:
 * helpers such as live/live-fetch.ts carry no directive, but they ship in the same client bundle.
 * Anywhere in that client graph it fails on a value import of:
 * - effect or @effect/*, motion or motion/*, and react-icons or react-icons/*: the islands use
 *   plain fetch through TanStack Query, CSS motion and lucide icons instead;
 * - '@/lib/http-clients/effect-fetcher', '@/lib/sanity/client' and @sanity/client: Effect's
 *   fetcher and the Sanity client run on the server only;
 * - the home data loaders (data/loaders.ts), anything under src/app/api (the Elysia and Effect
 *   route handlers) and 'server-only';
 * - '@/classes/error', whose BaseError is built on Effect's Data. It also catches a value import
 *   of data/tile-result.ts, whose settle() reports through it: islands import its types only.
 * However the module is spelled: '@/…', a relative path, with dot segments, an extension or
 * through /index.
 * Type-only imports are fine, because they are erased before bundling.
 *
 * Modules outside the home folder are checked by their specifier only, not followed: this guard
 * is about what the home islands add, and the shell already ships what they share with it (for
 * example the islands' '@/components/console/tile').
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROOT = process.cwd();
const HOME_DIR = 'src/app/_components/home';
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const CLIENT_DIRECTIVE = 'use client';

/** How a module path without an extension is completed into a file, in the bundler's order. */
const FILE_SUFFIXES = ['.ts', '.tsx', '/index.ts', '/index.tsx'] as const;

/** Packages the client graph may not load, with any subpath ('effect/Schema', 'react-icons/fa'). */
const BANNED_PACKAGES: readonly string[] = [
  'effect',
  '@effect',
  'motion',
  'react-icons',
  '@sanity/client',
  'server-only',
];

/** Repository modules (no extension, no /index) the client graph may not load. */
const BANNED_MODULES: ReadonlySet<string> = new Set([
  'src/lib/http-clients/effect-fetcher',
  'src/lib/sanity/client',
  'src/classes/error',
  `${HOME_DIR}/data/loaders`,
]);

/** Folders none of whose modules the client graph may load. */
const BANNED_FOLDERS: readonly string[] = ['src/app/api'];

/** A repository file's text (by its path with forward slashes), or undefined when there is none. */
type ReadSource = (file: string) => string | undefined;

/** Each module of the client graph, with the chain of imports that first reaches it (entry first). */
type ClientGraph = ReadonlyMap<string, readonly string[]>;

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
 * Whether the module is a client entry: 'use client' among the string-literal statements that
 * open it (its directive prologue). Comments, such as a license header, may come before it.
 */
const isClientModule = (source: string, file: string): boolean => {
  for (const statement of parse(source, file).statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      return false;
    }
    if (statement.expression.text === CLIENT_DIRECTIVE) return true;
  }
  return false;
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

/** Whether an export-from loads its module: anything but `export type` or all-`type` names. */
const isValueExport = (node: ts.ExportDeclaration): boolean => {
  if (node.isTypeOnly) return false;
  const clause = node.exportClause;
  if (clause === undefined || ts.isNamespaceExport(clause)) return true;
  return clause.elements.length === 0 || clause.elements.some((element) => !element.isTypeOnly);
};

/** The specifiers `source` loads at runtime: value imports, export-froms and dynamic imports. */
const valueSpecifiers = (source: string, file: string): string[] =>
  allNodes(parse(source, file)).flatMap((node) => {
    const specifier = specifierOf(node);
    if (specifier === undefined) return [];
    if (ts.isImportDeclaration(node) && !isValueImport(node)) return [];
    if (ts.isExportDeclaration(node) && !isValueExport(node)) return [];
    return [specifier];
  });

/**
 * The repository path `specifier` names from `file`, normalised ('.' and '..' resolved): '@/' is
 * src/, and a relative path resolves from the file's folder. Packages give undefined.
 */
const repoPathOf = (specifier: string, file: string): string | undefined => {
  if (specifier.startsWith('@/')) return posix.join('src', specifier.slice(2));
  if (specifier.startsWith('.')) return posix.join(posix.dirname(file), specifier);
  return undefined;
};

/** A repository path without its extension or a trailing /index: one id per module. */
const moduleIdOf = (path: string): string =>
  path.replace(SOURCE_FILE, '').replace(/\/(?:index)?$/, '');

const isPackage = (specifier: string, name: string): boolean =>
  specifier === name || specifier.startsWith(`${name}/`);

/** Whether the client graph may not load `specifier`, imported from `file`. */
const isBanned = (specifier: string, file: string): boolean => {
  const path = repoPathOf(specifier, file);
  if (path === undefined) return BANNED_PACKAGES.some((name) => isPackage(specifier, name));
  const id = moduleIdOf(path);
  return BANNED_MODULES.has(id) || BANNED_FOLDERS.some((folder) => id.startsWith(`${folder}/`));
};

/**
 * The source file a module path names: the path itself when it has a source extension, else the
 * first completion the bundler would find. A stylesheet ('./bento.module.css') names none.
 */
const resolveFile = (path: string, read: ReadSource): string | undefined => {
  const candidates = SOURCE_FILE.test(path) ? [path] : FILE_SUFFIXES.map((suffix) => path + suffix);
  return candidates.find((candidate) => read(candidate) !== undefined);
};

/** The home-folder modules `file` loads, as files: the ones the walk follows. */
const followedImports = (file: string, read: ReadSource): string[] =>
  valueSpecifiers(read(file) ?? '', file).flatMap((specifier) => {
    const path = repoPathOf(specifier, file);
    if (path === undefined || !path.startsWith(`${HOME_DIR}/`)) return [];
    const target = resolveFile(path, read);
    return target === undefined ? [] : [target];
  });

/** Adds `file` and what it loads to `graph`, each module once, with the chain that reached it. */
const walk = (
  graph: ClientGraph,
  file: string,
  chain: readonly string[],
  read: ReadSource,
): ClientGraph => {
  if (graph.has(file)) return graph;
  return followedImports(file, read).reduce<ClientGraph>(
    (reached, target) => walk(reached, target, [...chain, target], read),
    new Map([...graph, [file, chain]]),
  );
};

/** Every module the client entries load, following value imports within the home folder. */
const clientGraph = (entries: readonly string[], read: ReadSource): ClientGraph =>
  entries.reduce<ClientGraph>((graph, entry) => walk(graph, entry, [entry], read), new Map());

/** Each banned import in the graph, as 'entry -> … -> module imports <specifier>'. */
const violationsIn = (graph: ClientGraph, read: ReadSource): string[] =>
  [...graph].flatMap(([file, chain]) =>
    valueSpecifiers(read(file) ?? '', file)
      .filter((specifier) => isBanned(specifier, file))
      .map((specifier) => `${chain.join(' -> ')} imports '${specifier}'`),
  );

/** Reads a file of the working tree; a missing one gives undefined. */
const readRepoFile: ReadSource = (file) => {
  const path = join(ROOT, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
};

/** Every source file under the home folder, as a repository path with forward slashes. */
const homeSourceFiles = (): string[] =>
  (readdirSync(join(ROOT, HOME_DIR), { recursive: true }) as string[])
    .filter((file) => SOURCE_FILE.test(file))
    .map((file) => `${HOME_DIR}/${file.split(sep).join('/')}`)
    .sort();

const clientEntries = (): string[] =>
  homeSourceFiles().filter((file) => isClientModule(readRepoFile(file) ?? '', file));

/** A source reader over in-memory files. */
const fixture =
  (files: Readonly<Record<string, string>>): ReadSource =>
  (file) =>
    new Map(Object.entries(files)).get(file);

const ISLAND = `${HOME_DIR}/live/island.tsx`;
const HELPER = `${HOME_DIR}/live/helper.ts`;

/** The violations of a client graph whose one entry is an island with `source` after its directive. */
const violationsOf = (source: string, others: Readonly<Record<string, string>> = {}): string[] => {
  const read = fixture({ [ISLAND]: `'use client';\n${source}`, ...others });
  return violationsIn(clientGraph([ISLAND], read), read);
};

describe('the home client-import guard', () => {
  it.each([
    ["import { Effect } from 'effect';", 'effect'],
    ["import * as Schema from 'effect/Schema';", 'effect/Schema'],
    ["import { FetchHttpClient } from '@effect/platform';", '@effect/platform'],
    ["import { motion } from 'motion/react';", 'motion/react'],
    ["import { animate } from 'motion';", 'motion'],
    ["import { FaGithub } from 'react-icons/fa';", 'react-icons/fa'],
    ["import { IconContext } from 'react-icons';", 'react-icons'],
    [
      "import { get } from '@/lib/http-clients/effect-fetcher';",
      '@/lib/http-clients/effect-fetcher',
    ],
    ["import { client } from '@/lib/sanity/client';", '@/lib/sanity/client'],
    ["import { client } from '@/lib/sanity/client.ts';", '@/lib/sanity/client.ts'],
    ["import { client } from '@/lib/sanity/client/index';", '@/lib/sanity/client/index'],
    ["import { client } from '../../../../lib/sanity/client';", '../../../../lib/sanity/client'],
    // Dot segments in an alias still name the banned module.
    ["import { client } from '@/lib/sanity/../sanity/client';", '@/lib/sanity/../sanity/client'],
    ["import { client } from '@/lib/./sanity/client';", '@/lib/./sanity/client'],
    [
      "import { loadNowPlaying } from '@/app/_components/home/live/../data/loaders';",
      '@/app/_components/home/live/../data/loaders',
    ],
    ["import { createClient } from '@sanity/client';", '@sanity/client'],
    ["import { ensureBaseError } from '@/classes/error';", '@/classes/error'],
    ["import { loadNowPlaying } from '../data/loaders';", '../data/loaders'],
    [
      "import { loadNowPlaying } from '@/app/_components/home/data/loaders';",
      '@/app/_components/home/data/loaders',
    ],
    [
      "import { nowPlayingRoute } from '@/app/api/v1/[[...route]]/now-playing/handlers';",
      '@/app/api/v1/[[...route]]/now-playing/handlers',
    ],
    ["import 'server-only';", 'server-only'],
    // Every way of loading a module: default, mixed, side effect, re-export, dynamic import.
    ["import Effect, { type Layer } from 'effect';", 'effect'],
    ["import { type Layer, pipe } from 'effect';", 'effect'],
    ["import 'motion/react';", 'motion/react'],
    ["export { Effect } from 'effect';", 'effect'],
    ["export * from 'effect';", 'effect'],
    ["export * as Fx from 'effect';", 'effect'],
    // An empty binding list may still be kept as a side-effect import: counted, to be safe.
    ["import {} from 'effect';", 'effect'],
    ["export {} from 'effect';", 'effect'],
    ["const loaders = await import('../data/loaders');", '../data/loaders'],
    ['const icons = await import(`react-icons/fa`);', 'react-icons/fa'],
    // Inside JSX: an island in a .tsx file is parsed as TSX.
    ["export const Lazy = () => <div>{import('motion/react') && null}</div>;", 'motion/react'],
  ])('rejects %j in a client island', (source, specifier) => {
    expect(violationsOf(source)).toEqual([`${ISLAND} imports '${specifier}'`]);
  });

  it.each([
    "import type { Effect } from 'effect';",
    "import { type Effect, type Layer } from 'effect';",
    "export type { Effect } from 'effect';",
    "export { type Effect } from 'effect';",
    "type Motion = typeof import('motion/react');",
    "import type { LoaderResult } from '../data/loaders';",
    "import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';",
    // Look-alikes: a different package or module that only shares a prefix.
    "import { frame } from 'motion-utils';",
    "import { effectiveDate } from '@/lib/effect-dates';",
    "import { load } from '../data/loaders-copy';",
    "import { useQuery } from '@tanstack/react-query';",
    "import { AudioLines } from 'lucide-react';",
    // Not imports at all.
    "// import { Effect } from 'effect';",
    'const example = "import { Effect } from \'effect\'";',
  ])('allows %j in a client island', (source) => {
    expect(violationsOf(source)).toEqual([]);
  });

  it("follows a local helper the island loads, and reports the helper's banned import", () => {
    const helper = "import { Effect } from 'effect';\nexport const run = Effect.runPromise;";

    expect(violationsOf("import { run } from './helper';", { [HELPER]: helper })).toEqual([
      `${ISLAND} -> ${HELPER} imports 'effect'`,
    ]);
    expect(
      violationsOf("import { run } from '@/app/_components/home/live/helper.ts';", {
        [HELPER]: helper,
      }),
    ).toEqual([`${ISLAND} -> ${HELPER} imports 'effect'`]);
  });

  it("reports a value import of the real data/tile-result, which loads Effect's errors", () => {
    const tileResult = `${HOME_DIR}/data/tile-result.ts`;
    const files = { [tileResult]: readRepoFile(tileResult) ?? '' };

    expect(violationsOf("import { settle } from '../data/tile-result';", files)).toEqual([
      `${ISLAND} -> ${tileResult} imports '@/classes/error'`,
    ]);
    expect(violationsOf("import type { LiveInitial } from '../data/tile-result';", files)).toEqual(
      [],
    );
  });

  it('follows helpers through index files and several levels', () => {
    const files = {
      [`${HOME_DIR}/data/index.ts`]: "export { format } from './format';",
      [`${HOME_DIR}/data/format.ts`]: "import { client } from '@/lib/sanity/client';",
    };

    expect(violationsOf("import { format } from '../data';", files)).toEqual([
      `${ISLAND} -> ${HOME_DIR}/data/index.ts -> ${HOME_DIR}/data/format.ts imports '@/lib/sanity/client'`,
    ]);
  });

  it('does not follow type-only imports, stylesheets, or modules outside the home folder', () => {
    const effectful = "import { Effect } from 'effect';";
    const stylesheet = `${HOME_DIR}/live/styles.module.css`;

    expect(violationsOf("import type { Run } from './helper';", { [HELPER]: effectful })).toEqual(
      [],
    );
    // A stylesheet is never parsed as a module, whatever its text looks like.
    expect(
      violationsOf("import styles from './styles.module.css';", { [stylesheet]: effectful }),
    ).toEqual([]);
    expect(
      violationsOf("import { run } from '@/lib/helper';", { 'src/lib/helper.ts': effectful }),
    ).toEqual([]);
  });

  it('visits each module once, so an import cycle ends', () => {
    const helper = "import { island } from './island';\nimport 'server-only';";

    expect(violationsOf("import { run } from './helper';", { [HELPER]: helper })).toEqual([
      `${ISLAND} -> ${HELPER} imports 'server-only'`,
    ]);
  });

  it('leaves server modules alone: Effect is fine in a module without the directive', () => {
    const read = fixture({ [HELPER]: "import { Effect } from 'effect';" });
    const entries = [HELPER].filter((file) => isClientModule(read(file) ?? '', file));

    expect(violationsIn(clientGraph(entries, read), read)).toEqual([]);
  });

  it.each([
    "'use client';\nimport { useQuery } from '@tanstack/react-query';",
    '"use client"\nexport const a = 1;',
    "/**\n * Copyright 2025 Mike Odnis\n */\n\n'use client';\n\nexport const a = 1;",
    "// a comment first\n'use client';",
    "'use strict';\n'use client';",
  ])('sees %j as a client module', (source) => {
    expect(isClientModule(source, ISLAND)).toBe(true);
  });

  it.each([
    "import 'server-only';\n\n/** Not for a 'use client' module. */\nexport const a = 1;",
    "import { a } from './a';\n'use client';",
    "// 'use client';\nexport const a = 1;",
    "const directive = 'use client';",
    "'use server';",
    '',
  ])('sees %j as a server module', (source) => {
    expect(isClientModule(source, ISLAND)).toBe(false);
  });
});

describe('the home client islands', () => {
  it("finds the islands, and not server modules that only mention 'use client'", () => {
    const entries = clientEntries();

    expect(entries).toEqual(
      expect.arrayContaining([
        `${HOME_DIR}/live/now-playing-tile.tsx`,
        `${HOME_DIR}/live/status-tile.tsx`,
        `${HOME_DIR}/bento-masonry.tsx`,
      ]),
    );
    expect(entries).not.toContain(`${HOME_DIR}/home-page.tsx`);
    expect(entries).not.toContain(`${HOME_DIR}/bento-layout.ts`);
  });

  it('follows the islands into the local helpers they ship with', () => {
    const graph = clientGraph(clientEntries(), readRepoFile);

    expect([...graph.keys()]).toEqual(
      expect.arrayContaining([
        `${HOME_DIR}/live/live-fetch.ts`,
        `${HOME_DIR}/live/now-playing-view.ts`,
        `${HOME_DIR}/data/format.ts`,
        // The masonry island's row maths, shared with the server's estimates.
        `${HOME_DIR}/bento-layout.ts`,
      ]),
    );
  });

  it('keeps the masonry island to React and the plain bento-layout module', () => {
    const island = `${HOME_DIR}/bento-masonry.tsx`;
    const graph = clientGraph([island], readRepoFile);

    expect([...graph.keys()].sort()).toEqual([`${HOME_DIR}/bento-layout.ts`, island]);
    for (const file of graph.keys()) {
      const packages = valueSpecifiers(readRepoFile(file) ?? '', file).filter(
        (specifier) => repoPathOf(specifier, file) === undefined,
      );
      expect(packages, file).toEqual(file === island ? ['react'] : []);
    }
  });

  it('load no Effect, motion, react-icons, Sanity client, API handler, loader or server-only module', () => {
    const graph = clientGraph(clientEntries(), readRepoFile);

    expect(violationsIn(graph, readRepoFile)).toEqual([]);
  });
});
