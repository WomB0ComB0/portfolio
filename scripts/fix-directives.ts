#!/usr/bin/env bun

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
 * Fix misplaced `'use client'` / `'use server'` directives across a repo.
 *
 * - Removes any occurrences (even if wrapped like `('use client')` or with backticks)
 * - Reinserts a single canonical directive at the very top of the module
 *   (after shebang and leading comments), before imports/other code.
 *
 * Usage:
 *   bun scripts/fix-directives.ts                       # dry-run
 *   bun scripts/fix-directives.ts --write               # write in-place
 *   bun scripts/fix-directives.ts --write --mode=auto   # default: auto
 *   bun scripts/fix-directives.ts --write --mode=client # force 'use client'
 *   bun scripts/fix-directives.ts --write --mode=server # force 'use server'
 *   bun scripts/fix-directives.ts --include=src/<glob>/*.{ts,tsx,js,jsx}
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fg from 'fast-glob';
import MagicString from 'magic-string';

type Mode = 'auto' | 'client' | 'server';

const argv = new Map<string, string | boolean>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m?.[1]) argv.set(m[1], m[2] ?? true);
}

const WRITE = argv.get('write') === true;
const MODE = (argv.get('mode') as Mode) || 'auto';
const INCLUDE = (argv.get('include') as string) || '**/*.{ts,tsx,js,jsx,mts,mjs,cts,cjs}';

const files = await fg([INCLUDE], {
  dot: false,
  ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'],
});

const parserPlugins = [
  'jsx',
  'typescript',
  'importMeta',
  'topLevelAwait',
  'classProperties',
  'classPrivateProperties',
  'decorators-legacy',
] as const;

let changedCount = 0;
let skippedBothDirectives = 0;

for (const file of files) {
  const full = path.resolve(file);
  const code = await fs.readFile(full, 'utf8');

  // Quick exit if nothing interesting inside
  if (!/use\s+(client|server)/.test(code)) continue;

  const s = new MagicString(code);

  // capture shebang and leading comments (kept as-is)
  const shebangMatch = /^#!.*\n/.exec(code);
  const shebangEnd = shebangMatch ? shebangMatch[0].length : 0;

  // Parse once
  let ast: ReturnType<typeof parse> | null;
  try {
    ast = parse(code, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      startLine: 1,
      plugins: [...parserPlugins],
    });
  } catch {
    // If parsing fails, skip (don’t corrupt file)
    continue;
  }

  // Detect which directive(s) are present
  const found = new Set<'client' | 'server'>();
  type NodeWithRange = { start?: number; end?: number };

  const toRemove: NodeWithRange[] = [];

  traverse(ast, {
    Program(p) {
      // 1) Proper directives in Program.directives
      for (const d of p.node.directives) {
        if (d.value.value === 'use client' || d.value.value === 'use server') {
          found.add(d.value.value.endsWith('client') ? 'client' : 'server');
          toRemove.push(d as unknown as NodeWithRange);
        }
      }
    },
    // 2) Any top-level ExpressionStatement that’s effectively a directive
    ExpressionStatement(p) {
      if (p.parent.type !== 'Program') return;
      // unwrap parentheses: ('use client');
      // we consider string literals only (no TemplateLiteral)
      // @ts-expect-error – different babel versions expose different fields
      const expr = p.node.expression?.expression ?? p.node.expression;
      if (!expr) return;

      if (expr.type === 'StringLiteral') {
        const v = expr.value;
        if (v === 'use client' || v === 'use server') {
          found.add(v.endsWith('client') ? 'client' : 'server');
          toRemove.push(p.node as unknown as NodeWithRange);
        }
      }
      // Backtick case: `use client` – not valid; normalize by removing
      if (expr.type === 'TemplateLiteral' && expr.quasis.length === 1) {
        const raw = expr.quasis[0].value.cooked;
        if (raw === 'use client' || raw === 'use server') {
          found.add(raw.endsWith('client') ? 'client' : 'server');
          toRemove.push(p.node as unknown as NodeWithRange);
        }
      }
    },
  });

  if (found.size === 0) continue;

  // If BOTH present, we won’t guess. Default: skip unless user forces a mode.
  if (found.size > 1 && MODE === 'auto') {
    skippedBothDirectives++;
    continue;
  }

  let target: 'use client' | 'use server';
  if (MODE === 'client') {
    target = 'use client';
  } else if (MODE === 'server') {
    target = 'use server';
  } else if (found.has('client')) {
    target = 'use client';
  } else {
    target = 'use server';
  }

  // Remove all existing directive statements we found
  for (const n of toRemove) {
    if (typeof n.start === 'number' && typeof n.end === 'number') {
      s.remove(n.start, n.end);
    }
  }

  // Re-parse after removal to safely find the first import (for insertion point)
  const updated = s.toString();
  try {
    parse(updated, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      startLine: 1,
      plugins: [...parserPlugins],
    });
  } catch {
    continue;
  }

  // Determine insertion index:
  // After shebang & any leading comments/whitespace, but BEFORE first ImportDeclaration or any statement.
  let insertAt = shebangEnd;

  // Preserve leading block/line comments
  // Find first non-whitespace after shebang
  const leading = updated.slice(shebangEnd);
  const m = /^\s*/.exec(leading);
  if (m) insertAt = shebangEnd + m[0].length;

  // However, if the first *code* is an import or any statement, we still insert at (shebang + comments) start.
  // That satisfies “must be at the very beginning of a file, above any imports or other code”.
  // We’ll also ensure a trailing newline.
  const directiveLine = `'${target}';\n`;

  // Avoid adding a duplicate if it’s already exactly correct at the very top
  const alreadyTop = updated
    .slice(insertAt, insertAt + directiveLine.length)
    .startsWith(directiveLine);

  if (!alreadyTop) {
    s.prependLeft(insertAt, directiveLine);
  }

  // Final write or preview
  const out = s.toString();
  if (out !== code) {
    changedCount++;
    if (WRITE) {
      await fs.writeFile(full, out, 'utf8');
    } else {
      const rel = path.relative(process.cwd(), full);
      console.log(`[dry-run] would fix: ${rel} -> ${target}`);
    }
  }
}

if (WRITE) {
  console.log(
    `\nWrote fixes to ${changedCount} file(s)${
      skippedBothDirectives
        ? `, skipped (both client/server present): ${skippedBothDirectives}`
        : ''
    }.`,
  );
} else {
  console.log(
    `\nDone (dry-run). Files to change: ${changedCount}${
      skippedBothDirectives
        ? `, skipped (both client/server present): ${skippedBothDirectives}`
        : ''
    }`,
  );
}
