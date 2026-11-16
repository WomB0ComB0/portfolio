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
 * @file The project page and the shared photo viewer stay on the palette (the owner's standing
 * rule) and on the refined type: no colour literals, chart colours, Tailwind palette scales or
 * inline colour styles; no tracked upper-case mono kickers (label-mono, uppercase); and motion
 * only on transform and opacity (plus colour fades), never on layout.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const DIRS = [
  'src/app/(routes)/(main)/(professioal)/projects/_components/detail',
  'src/app/(routes)/(main)/(professioal)/projects/_interface/project-detail',
  'src/components/console/photo',
];

const FILES = DIRS.flatMap((dir) =>
  readdirSync(path.join(ROOT, dir))
    .filter((name) => /\.(tsx?|css)$/.test(name))
    .map((name) => path.join(dir, name)),
);

/** A file's text without its comments (a licence or doc comment may name a colour). */
const codeOf = (file: string): string =>
  readFileSync(path.join(ROOT, file), 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|[^:'"])\/\/.*$/gm, '$1');

describe('the project page files', () => {
  it('are all read (the folders exist and hold the page)', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(15);
  });
});

describe.each(FILES)('%s', (file) => {
  const code = codeOf(file);

  it('has no colour literals', () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b(?![-\w])/i);
    expect(code).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/i);
  });

  it('uses no chart colours or Tailwind palette scales', () => {
    expect(code).not.toMatch(/--chart-\d/);
    expect(code).not.toMatch(
      /\b(?:bg|text|border|ring|from|to|via)-(?:red|green|blue|emerald|amber|violet|purple|pink|zinc|slate|gray|orange|yellow|teal|cyan|indigo|rose|lime|sky|fuchsia)-\d/,
    );
  });

  it('sets no colour inline', () => {
    expect(code).not.toMatch(/style=\{\{[^}]*\b(?:color|background|backgroundColor|borderColor)\b/);
  });

  it('sets no tracked upper-case kickers', () => {
    expect(code).not.toMatch(/label-mono|text-transform:\s*uppercase|\buppercase\b/);
  });

  it('animates only transform, opacity and colour, never layout', () => {
    const transitions = [...code.matchAll(/transition(?:-property)?:\s*([^;]+);/g)].map(
      (match) => match[1] ?? '',
    );
    for (const value of transitions) {
      expect(value).not.toMatch(/\b(?:width|height|top|left|right|bottom|margin|padding|all)\b/);
    }
  });
});
