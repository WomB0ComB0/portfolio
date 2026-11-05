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
 * @file The cookie, licence and privacy pages are server components.
 *
 * Their text reaches the server HTML without a client bundle or a next/dynamic boundary. Only the
 * interactive leaves (MagicCard, next/link, the separator) stay client components, and they come
 * from their own modules rather than the '@/components' barrel, which would drag the command
 * palette and the shell into the server graph.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JSX, ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { Cookies } from '@/app/(routes)/(legal)/cookies/_interface/cookies/cookies';
import CookiesPage from '@/app/(routes)/(legal)/cookies/page';
import { Licenses } from '@/app/(routes)/(legal)/licenses/_interface/licenses/licenses';
import LicensesPage from '@/app/(routes)/(legal)/licenses/page';
import { Privacy } from '@/app/(routes)/(legal)/privacy/_interface/privacy/privacy';
import PrivacyPage from '@/app/(routes)/(legal)/privacy/page';

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROOT = process.cwd();
const LEGAL_DIR = 'src/app/(routes)/(legal)';
const COMPONENTS_BARREL = /^@\/components\/?(?:index)?$/;
const SHELL_MODULE = /^@\/components\/layout(?:\/|$)/;

interface LegalPage {
  readonly name: string;
  readonly heading: string;
  readonly interfaceFile: string;
  readonly Interface: () => JSX.Element;
  readonly Page: () => JSX.Element;
}

const LEGAL_PAGES: readonly LegalPage[] = [
  {
    name: 'cookies',
    heading: 'Cookies Policy',
    interfaceFile: `${LEGAL_DIR}/cookies/_interface/cookies/cookies.tsx`,
    Interface: Cookies,
    Page: CookiesPage,
  },
  {
    name: 'licenses',
    heading: 'Content Licenses',
    interfaceFile: `${LEGAL_DIR}/licenses/_interface/licenses/licenses.tsx`,
    Interface: Licenses,
    Page: LicensesPage,
  },
  {
    name: 'privacy',
    heading: 'Privacy Policy',
    interfaceFile: `${LEGAL_DIR}/privacy/_interface/privacy/privacy.tsx`,
    Interface: Privacy,
    Page: PrivacyPage,
  },
];

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );

/** The directive prologue: the string-literal statements before the first other statement. */
const directivesOf = (source: ts.SourceFile): string[] => {
  const directives: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    directives.push(statement.expression.text);
  }
  return directives;
};

/** Every module a file imports or re-exports from. */
const moduleSpecifiersOf = (source: ts.SourceFile): string[] =>
  source.statements.flatMap((statement) => {
    const specifier =
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
        ? statement.moduleSpecifier
        : undefined;
    return specifier !== undefined && ts.isStringLiteral(specifier) ? [specifier.text] : [];
  });

/** `html` with every `<...>` run dropped, scanned once so no tag can be rebuilt from the parts. */
const withoutTags = (html: string): string => {
  let text = '';
  let inTag = false;
  for (const char of html) {
    if (char === '<') inTag = true;
    else if (char === '>') inTag = false;
    else if (!inTag) text += char;
  }
  return text;
};

/** The `<h1>` texts in server HTML, with tags dropped and whitespace runs collapsed. */
const headingsIn = (html: string): string[] =>
  [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(([, inner = '']) =>
    withoutTags(inner).replaceAll(/\s+/g, ' ').trim(),
  );

describe.each(LEGAL_PAGES)('$name page', ({ heading, interfaceFile, Interface, Page }) => {
  it('is not a client module', () => {
    expect(directivesOf(parse(interfaceFile))).not.toContain('use client');
  });

  it('imports neither the shell nor the components barrel', () => {
    const specifiers = moduleSpecifiersOf(parse(interfaceFile));

    expect(specifiers.filter((specifier) => COMPONENTS_BARREL.test(specifier))).toEqual([]);
    expect(specifiers.filter((specifier) => SHELL_MODULE.test(specifier))).toEqual([]);
  });

  it('renders its interface directly, with no next/dynamic wrapper', () => {
    // A server page is a plain function: calling it outside React must not need a dispatcher.
    const element: ReactElement = Page();

    expect(element.type).toBe(Interface);
  });

  it('renders to server HTML with no providers, under one h1', () => {
    // Called as a plain function, so a hook in the interface itself fails here, not in React.
    const html = renderToString(Interface());

    expect(headingsIn(html)).toEqual([heading]);
  });
});
